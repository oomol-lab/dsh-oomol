import type { Context, Fiber } from "@deepseek-ai/cordis"
import { credentialRef } from "@deepseek-ai/dsh-credentials"
import type {} from "@deepseek-ai/dsh-credentials/types"
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment"
import * as mcpClient from "@deepseek-ai/dsh-mcp-client"
import Schema from "@deepseek-ai/schemastery"

import {
  DEFAULT_API_KEY_ENV,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_SERVER_NAME,
  DEFAULT_TEAM_NAME_ENV,
  resolveOomolConnectionIfConfigured,
  type OomolConnectorConfig,
} from "./runtime.js"

export const name = "oomol"
export const inject = ["tools"]

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

  const reload = (initial: boolean): Promise<void> => {
    const operation = reloadQueue.catch(() => undefined).then(async () => {
      if (disposed) return
      await activeClient?.dispose()
      activeClient = undefined

      const credentials = ctx.get("credentials")
      const resolved = await resolveOomolConnectionIfConfigured(config, {
        readCredential: async (name) => {
          if (!credentials) return undefined
          return (await credentials.resolve(credentialRef(name)))?.value
        },
        readEnvironment: (name) => launchEnvironment.get(name)?.value,
      })

      // Missing credentials are deliberately non-fatal: the browser settings
      // card must be able to load and configure a freshly installed plugin.
      if (!resolved || disposed) return

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
  DEFAULT_SERVER_NAME,
  DEFAULT_TEAM_NAME_ENV,
  normalizeMcpEndpoint,
  resolveOomolConnection,
  resolveOomolConnectionIfConfigured,
} from "./runtime.js"
export type { OomolConnectorConfig, ResolvedOomolConnection, RuntimeValues } from "./runtime.js"
