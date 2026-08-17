import type { Context, Fiber } from "@deepseek-ai/cordis"
import type {} from "@deepseek-ai/dsh-client-connection"
import { credentialRef } from "@deepseek-ai/dsh-credentials"
import type {} from "@deepseek-ai/dsh-credentials/types"
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment"
import * as mcpClient from "@deepseek-ai/dsh-mcp-client"
import Schema from "@deepseek-ai/schemastery"

import { createConnectionsRpcHandler } from "./connections.js"
import { createRepositoryRpcHandler } from "./repository.js"
import {
  statusFromConnectionReason,
  type OomolConnectionStatus,
} from "./health.js"
import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_SERVER_NAME,
  DEFAULT_TEAM_NAME_ENV,
  resolveOomolConnectionIfConfigured,
  type OomolConnectorConfig,
} from "./runtime.js"

export const name = "oomol"
export const inject = ["tools", "connection"]

export type Config = OomolConnectorConfig

export const Config: Schema<Config> = Schema.object({
  endpoint: Schema.string().default(DEFAULT_MCP_ENDPOINT),
  apiKeyEnv: Schema.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
  teamName: Schema.string(),
  teamNameEnv: Schema.string().default(DEFAULT_TEAM_NAME_ENV),
  serverName: Schema.string().default(DEFAULT_SERVER_NAME),
  toolCallTimeoutMs: Schema.number().min(1).default(60_000),
  failOnStartupError: Schema.boolean().default(false),
})

export async function apply(ctx: Context, config: Config): Promise<void> {
  const launchEnvironment = launchEnvironmentOf(ctx)
  const apiKeyEnv = config.apiKeyEnv?.trim() || DEFAULT_API_KEY_ENV
  let activeClient: Fiber | undefined
  let disposed = false
  let reloadQueue = Promise.resolve()
  let statusRevision = 0
  let status: OomolConnectionStatus = { phase: "unconfigured" }

  const resolveConnection = () => resolveOomolConnectionIfConfigured(config, {
    readCredential: async (name) => {
      const credentials = ctx.get("credentials")
      if (!credentials) return undefined
      return (await credentials.resolve(credentialRef(name)))?.value
    },
    readEnvironment: (name) => launchEnvironment.get(name)?.value,
  })

  const handleConnectionsRpc = createConnectionsRpcHandler({ resolveConnection })

  const testConnection = async (): Promise<OomolConnectionStatus> => {
    const revision = ++statusRevision
    status = { phase: "connecting" }
    const result = await handleConnectionsRpc(
      "connections/list",
      {},
      AbortSignal.timeout(Math.min(config.toolCallTimeoutMs ?? 60_000, 15_000)),
    )
    const checkedAt = new Date().toISOString()
    const next: OomolConnectionStatus = result.ok
      ? { phase: "connected", checkedAt }
      : result.error.reason === "unconfigured"
        ? { phase: "unconfigured", checkedAt }
        : statusFromConnectionReason(result.error.reason, checkedAt)
    if (revision === statusRevision) status = next
    return status
  }

  const handleRepositoryRpc = createRepositoryRpcHandler()

  const handleOomolRpc = async (endpoint: string, payload: unknown, signal: AbortSignal) => {
    if (endpoint === "status") return { ok: true as const, value: status }
    if (endpoint === "test") return { ok: true as const, value: await testConnection() }
    if (endpoint.startsWith("repository/")) return { ok: true as const, value: await handleRepositoryRpc(endpoint, signal) }
    if (endpoint.startsWith("connections/")) return { ok: true as const, value: await handleConnectionsRpc(endpoint, payload, signal) }
    return {
      ok: false as const,
      error: { code: "internal" as const, message: "Unknown OOMOL RPC endpoint", details: {} },
    }
  }

  ctx.effect(
    () => ctx.connection.rpc.handle("/oomol", handleOomolRpc, { authority: "loopback" }),
    "oomol: loopback RPC",
  )

  const reload = (initial: boolean): Promise<void> => {
    const operation = reloadQueue.catch(() => undefined).then(async () => {
      if (disposed) return
      statusRevision += 1
      await activeClient?.dispose()
      activeClient = undefined

      const resolved = await resolveConnection()

      // Missing credentials are deliberately non-fatal: the browser settings
      // card must be able to load and configure a freshly installed plugin.
      if (!resolved || disposed) {
        status = { phase: "unconfigured" }
        return
      }
      status = { phase: "connecting" }

      const client = ctx.plugin(mcpClient, {
        failOnStartupError: resolved.failOnStartupError,
        headers: resolved.headers,
        serverName: resolved.serverName,
        toolCallTimeoutMs: resolved.toolCallTimeoutMs,
        transport: "streamable-http",
        url: resolved.endpoint,
      })

      try {
        await client
        if (disposed) {
          await client.dispose()
          return
        }
        activeClient = client
      } catch (error) {
        await client.dispose()
        status = { phase: "unavailable", checkedAt: new Date().toISOString(), errorCode: "unavailable" }
        if (initial && resolved.failOnStartupError) throw error
      }
    })
    reloadQueue = operation
    return operation
  }

  await reload(true)
  if (status.phase === "connecting") void testConnection()

  ctx.on("credentials/updated", (ref) => {
    if (String(ref) !== apiKeyEnv) return
    void reload(false).then(() => {
      if (status.phase === "connecting") return testConnection()
    })
  })

  ctx.effect(() => async () => {
    disposed = true
    await reloadQueue.catch(() => undefined)
    await activeClient?.dispose()
    activeClient = undefined
  }, "oomol: dispose MCP client")
}

export {
  DEFAULT_API_KEY_ENV,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_SERVER_NAME,
  DEFAULT_TEAM_NAME_ENV,
  normalizeMcpEndpoint,
  resolveOomolConnection,
  resolveOomolConnectionIfConfigured,
} from "./runtime.js"
export { statusFromConnectionReason } from "./health.js"
export type { OomolConnectionPhase, OomolConnectionStatus } from "./health.js"
export type { OomolConnectorConfig, ResolvedOomolConnection, RuntimeValues } from "./runtime.js"
