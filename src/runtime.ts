export const DEFAULT_MCP_ENDPOINT = "https://connector.oomol.com/v1/mcp"
export const DEFAULT_API_KEY_ENV = "OOMOL_MCP_API_KEY"
export const DEFAULT_TEAM_NAME_ENV = "OOMOL_TEAM_NAME"
export const DEFAULT_SERVER_NAME = "oomol"

const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface OomolConnectorConfig {
  endpoint?: string
  apiKeyEnv?: string
  teamName?: string
  teamNameEnv?: string
  serverName?: string
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
}

export interface RuntimeValues {
  readCredential(name: string): Promise<string | undefined>
  readEnvironment(name: string): string | undefined
}

export interface ResolvedOomolConnection {
  endpoint: string
  headers: Record<string, string>
  serverName: string
  toolCallTimeoutMs: number
  failOnStartupError: boolean
}

export async function resolveOomolConnection(
  config: OomolConnectorConfig,
  runtime: RuntimeValues,
): Promise<ResolvedOomolConnection> {
  const resolved = await resolveOomolConnectionIfConfigured(config, runtime)
  if (resolved) return resolved

  const apiKeyEnv = nonEmpty(config.apiKeyEnv) ?? DEFAULT_API_KEY_ENV
  throw new Error(
    `OOMOL Connector is not configured. Store credential ${apiKeyEnv} in DeepSeek Harness or export ${apiKeyEnv} before starting dsh.`,
  )
}

/**
 * Resolve the connection when a key is available. An unconfigured plugin is a
 * normal state so the Host and its settings card can still start.
 */
export async function resolveOomolConnectionIfConfigured(
  config: OomolConnectorConfig,
  runtime: RuntimeValues,
): Promise<ResolvedOomolConnection | undefined> {
  const apiKeyEnv = nonEmpty(config.apiKeyEnv) ?? DEFAULT_API_KEY_ENV
  validateCredentialRef(apiKeyEnv, "apiKeyEnv")
  const storedApiKey = nonEmpty(await runtime.readCredential(apiKeyEnv))
  const environmentApiKey = nonEmpty(runtime.readEnvironment(apiKeyEnv))
  const apiKey = storedApiKey ?? environmentApiKey

  if (!apiKey) return undefined

  const teamNameEnv = nonEmpty(config.teamNameEnv) ?? DEFAULT_TEAM_NAME_ENV
  validateCredentialRef(teamNameEnv, "teamNameEnv")
  const teamName = nonEmpty(config.teamName) ?? nonEmpty(runtime.readEnvironment(teamNameEnv))
  const endpoint = normalizeMcpEndpoint(config.endpoint ?? DEFAULT_MCP_ENDPOINT)
  const serverName = nonEmpty(config.serverName) ?? DEFAULT_SERVER_NAME

  if (!SERVER_NAME_PATTERN.test(serverName)) {
    throw new Error(`Invalid OOMOL MCP serverName: ${serverName}`)
  }

  const toolCallTimeoutMs = config.toolCallTimeoutMs ?? 60_000
  if (!Number.isSafeInteger(toolCallTimeoutMs) || toolCallTimeoutMs < 1) {
    throw new Error("toolCallTimeoutMs must be a positive safe integer")
  }

  return {
    endpoint,
    failOnStartupError: config.failOnStartupError ?? false,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(teamName ? { "x-oo-team-name": teamName } : {}),
    },
    serverName,
    toolCallTimeoutMs,
  }
}

function validateCredentialRef(value: string, field: string): void {
  if (!CREDENTIAL_REF_PATTERN.test(value)) {
    throw new Error(`${field} must be a POSIX environment-variable name`)
  }
}

export function normalizeMcpEndpoint(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid OOMOL MCP endpoint: ${value}`)
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("OOMOL MCP endpoint must use http or https")
  }
  if (url.username || url.password) {
    throw new Error("OOMOL MCP endpoint must not contain credentials")
  }
  if (url.hash) {
    throw new Error("OOMOL MCP endpoint must not contain a fragment")
  }

  return url.toString()
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}
