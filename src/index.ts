import type { Context, Fiber } from "@deepseek-ai/cordis"
import type {} from "@deepseek-ai/dsh-client-connection"
import { credentialRef } from "@deepseek-ai/dsh-credentials"
import type {} from "@deepseek-ai/dsh-credentials/types"
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment"
import * as mcpClient from "@deepseek-ai/dsh-mcp-client"
import { settingsNamespace } from "@deepseek-ai/dsh-settings"
import Schema from "@deepseek-ai/schemastery"

import { createConnectionsRpcHandler } from "./connections.js"
import { createRepositoryRpcHandler } from "./repository.js"
import { statusFromMcpError, type OomolConnectionStatus } from "./health.js"
import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_SELF_HOSTED_API_KEY_ENV,
  DEFAULT_SERVER_NAME,
  DEFAULT_TEAM_NAME_ENV,
  resolveConnectorConfiguration,
  resolveOomolConnectionIfConfigured,
  type OomolConnectorConfig,
} from "./runtime.js"

export const name = "oomol"
export const inject = ["tools", "connection", "settings"]

export type Config = OomolConnectorConfig

export const Config: Schema<Config> = Schema.object({
  endpoint: Schema.string().default(DEFAULT_MCP_ENDPOINT),
  apiKeyEnv: Schema.string().role("credential-ref"),
  teamName: Schema.string(),
  teamNameEnv: Schema.string().default(DEFAULT_TEAM_NAME_ENV),
  serverName: Schema.string().default(DEFAULT_SERVER_NAME),
  toolCallTimeoutMs: Schema.number().min(1).default(60_000),
  failOnStartupError: Schema.boolean().default(false),
})

export async function apply(ctx: Context, config: Config): Promise<void> {
  ctx.settings.register(settingsNamespace("oomol"), Config, { base: config, applies: "restart" })
  const launchEnvironment = launchEnvironmentOf(ctx)
  const initialConfiguration = resolveConnectorConfiguration(config)
  const apiKeyEnv = initialConfiguration.apiKeyEnv
  let activeClient: Fiber | undefined
  let disposed = false
  let reloadQueue = Promise.resolve()
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

  const handleRepositoryRpc = createRepositoryRpcHandler()

  const handleOomolRpc = async (endpoint: string, payload: unknown, signal: AbortSignal) => {
    if (endpoint === "configuration") {
      const resolved = await resolveConnection()
      return { ok: true as const, value: initialConfiguration }
    }
    if (endpoint === "status") return { ok: true as const, value: status }
    if (endpoint === "test") {
      await reload(false)
      return { ok: true as const, value: status }
    }
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
        failOnStartupError: true,
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
        status = { phase: "connected", checkedAt: new Date().toISOString() }
      } catch (error) {
        await client.dispose()
        status = statusFromMcpError(error)
        if (initial && resolved.failOnStartupError) throw error
      }
    })
    reloadQueue = operation
    return operation
  }

  await reload(true)

  ctx.on("credentials/updated", (ref) => {
    if (String(ref) !== apiKeyEnv) return
    void reload(false)
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
  DEFAULT_SELF_HOSTED_API_KEY_ENV,
  DEFAULT_SERVER_NAME,
  DEFAULT_TEAM_NAME_ENV,
  normalizeMcpEndpoint,
  connectorModeFromEndpoint,
  defaultApiKeyEnv,
  resolveConnectorConfiguration,
  resolveOomolConnection,
  resolveOomolConnectionIfConfigured,
} from "./runtime.js"
export { statusFromConnectionReason } from "./health.js"
export type { OomolConnectionPhase, OomolConnectionStatus } from "./health.js"
export type { ConnectorConfiguration, ConnectorMode, OomolConnectorConfig, ResolvedOomolConnection, RuntimeValues } from "./runtime.js"
