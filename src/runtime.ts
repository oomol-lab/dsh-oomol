export const DEFAULT_MCP_ENDPOINT = "https://connector.oomol.com/v1/mcp"
export const DEFAULT_API_KEY_ENV = "OOMOL_MCP_API_KEY"
export const DEFAULT_SELF_HOSTED_API_KEY_ENV = "OOMOL_CONNECT_RUNTIME_TOKEN"
export const DEFAULT_TEAM_NAME_ENV = "OOMOL_TEAM_NAME"
export const DEFAULT_SERVER_NAME = "oomol"

export type ConnectorMode = "oomol-hosted" | "self-hosted"

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
  mode: ConnectorMode
  endpoint: string
  apiKeyEnv: string
  headers: Record<string, string>
  consoleUrl: string
  serverName: string
  toolCallTimeoutMs: number
  failOnStartupError: boolean
}

export interface ConnectorConfiguration {
  mode: ConnectorMode
  endpoint: string
  apiKeyEnv: string
  credentialRequired: boolean
  connectionsManagement: "embedded" | "external"
  consoleUrl: string
}

export async function resolveOomolConnection(
  config: OomolConnectorConfig,
  runtime: RuntimeValues,
): Promise<ResolvedOomolConnection> {
  const resolved = await resolveOomolConnectionIfConfigured(config, runtime)
  if (resolved) return resolved

  const apiKeyEnv = resolveConnectorConfiguration(config).apiKeyEnv
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
  const configuration = resolveConnectorConfiguration(config)
  const { apiKeyEnv, endpoint, mode } = configuration
  const storedApiKey = nonEmpty(await runtime.readCredential(apiKeyEnv))
  const environmentApiKey = nonEmpty(runtime.readEnvironment(apiKeyEnv))
  const apiKey = storedApiKey ?? environmentApiKey

  if (!apiKey && mode === "oomol-hosted") return undefined

  const teamNameEnv = nonEmpty(config.teamNameEnv) ?? DEFAULT_TEAM_NAME_ENV
  validateCredentialRef(teamNameEnv, "teamNameEnv")
  const teamName = mode === "oomol-hosted"
    ? nonEmpty(config.teamName) ?? nonEmpty(runtime.readEnvironment(teamNameEnv))
    : undefined
  const serverName = nonEmpty(config.serverName) ?? DEFAULT_SERVER_NAME

  if (!SERVER_NAME_PATTERN.test(serverName)) {
    throw new Error(`Invalid OOMOL MCP serverName: ${serverName}`)
  }

  const toolCallTimeoutMs = config.toolCallTimeoutMs ?? 60_000
  if (!Number.isSafeInteger(toolCallTimeoutMs) || toolCallTimeoutMs < 1) {
    throw new Error("toolCallTimeoutMs must be a positive safe integer")
  }

  return {
    mode,
    endpoint,
    apiKeyEnv,
    failOnStartupError: config.failOnStartupError ?? false,
    headers: apiKey
      ? { Authorization: `Bearer ${apiKey}`, ...(teamName ? { "x-oo-team-name": teamName } : {}) }
      : {},
    consoleUrl: configuration.consoleUrl,
    serverName,
    toolCallTimeoutMs,
  }
}

export function resolveConnectorConfiguration(config: OomolConnectorConfig): ConnectorConfiguration {
  const endpoint = normalizeMcpEndpoint(config.endpoint ?? DEFAULT_MCP_ENDPOINT)
  const mode = connectorModeFromEndpoint(endpoint)
  const apiKeyEnv = nonEmpty(config.apiKeyEnv) ?? defaultApiKeyEnv(mode)
  validateCredentialRef(apiKeyEnv, "apiKeyEnv")
  return {
    mode,
    endpoint,
    apiKeyEnv,
    credentialRequired: mode === "oomol-hosted",
    connectionsManagement: mode === "oomol-hosted" ? "embedded" : "external",
    consoleUrl: new URL(endpoint).origin,
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
  if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
    throw new Error("HTTP OOMOL MCP endpoints must use localhost or a loopback IP address")
  }

  return url.toString()
}

export function connectorModeFromEndpoint(endpoint: string): ConnectorMode {
  return comparableEndpoint(endpoint) === comparableEndpoint(DEFAULT_MCP_ENDPOINT)
    ? "oomol-hosted"
    : "self-hosted"
}

export function defaultApiKeyEnv(mode: ConnectorMode): string {
  return mode === "oomol-hosted" ? DEFAULT_API_KEY_ENV : DEFAULT_SELF_HOSTED_API_KEY_ENV
}

function comparableEndpoint(value: string): string {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/$/, "")
  return url.toString()
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.startsWith("127.") || hostname === "[::1]"
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}
