import type { ResolvedOomolConnection } from "./runtime.js"

const AUTH_TYPES = ["oauth2", "api_key", "custom_credential", "federated", "no_auth"] as const
const IDENTIFIER = /^[A-Za-z0-9_-]{1,160}$/
const OAUTH_RETURN_URI = "https://console.oomol.com/app-connections/callback"
const MAX_CREDENTIAL_BYTES = 512 * 1024

type AuthType = (typeof AUTH_TYPES)[number]
type JsonRecord = Record<string, unknown>

export interface ConnectionsRpcContext {
  resolveConnection(): Promise<ResolvedOomolConnection | undefined>
}

export function createConnectionsRpcHandler(context: ConnectionsRpcContext) {
  return async (endpoint: string, payload: unknown, signal: AbortSignal) => {
    try {
      const connection = await context.resolveConnection()
      if (!connection) return rpcError("unconfigured", "Configure an OOMOL MCP key first.")

      if (endpoint === "connections/list") {
        const [providers, apps] = await Promise.all([
          requestConnector(connection, "/v1/providers", { signal }),
          requestConnector(connection, "/v1/apps", { signal }),
        ])
        return {
          ok: true as const,
          value: {
            providers: arrayData(providers).map(sanitizeProviderListItem).filter(isPresent),
            apps: arrayData(apps).map(sanitizeApp).filter(isPresent),
          },
        }
      }

      if (endpoint === "connections/provider") {
        const service = readIdentifier(payload, "service")
        const provider = await requestConnector(connection, `/v1/providers/${encodeURIComponent(service)}`, { signal })
        const value = sanitizeProviderDetail(dataOf(provider))
        if (!value) throw new ConnectionsRequestError("invalid_response", "OOMOL returned an invalid Provider.")
        return { ok: true as const, value }
      }

      if (endpoint === "connections/connect") {
        const input = readConnectInput(payload)
        const path = connectPath(input)
        const body = connectBody(input)
        const response = await requestConnector(connection, path, {
          method: "POST",
          body,
          signal,
        })
        const result = recordOf(dataOf(response))
        const authorizationUrl = optionalHttpUrl(result?.authorizationUrl)
        const app = sanitizeApp(result?.app ?? result)
        return { ok: true as const, value: { ...(authorizationUrl ? { authorizationUrl } : {}), ...(app ? { app } : {}) } }
      }

      if (endpoint === "connections/disconnect") {
        const appId = readIdentifier(payload, "appId")
        await requestConnector(connection, `/v1/apps/by-id/${encodeURIComponent(appId)}`, {
          method: "DELETE",
          body: null,
          signal,
        })
        return { ok: true as const, value: { disconnected: true } }
      }

      return rpcError("not_found", "Unknown OOMOL Connections operation.")
    } catch (error) {
      if (error instanceof ConnectionsRequestError) return rpcError(error.code, error.message)
      if (signal.aborted) return rpcError("cancelled", "The OOMOL Connections request was cancelled.")
      return rpcError("unavailable", "OOMOL Connections is temporarily unavailable.")
    }
  }
}

export interface ConnectInput {
  service: string
  appId?: string
  authType: AuthType
  apiKey?: string
  values?: Record<string, string>
  extra?: Record<string, string>
  comment?: string
  authorizationScopes?: string[]
}

function connectPath(input: ConnectInput): string {
  const root = input.appId
    ? `/v1/apps/by-id/${encodeURIComponent(input.appId)}/connect`
    : `/v1/apps/${encodeURIComponent(input.service)}/connect`
  if (input.authType === "oauth2") return root
  if (input.authType === "api_key") return `${root}/api-key`
  if (input.authType === "custom_credential") return `${root}/custom-credential`
  if (input.authType === "no_auth") return `${root}/no-auth`
  throw new ConnectionsRequestError("unsupported", "Federated connections are not available in this preview.")
}

function connectBody(input: ConnectInput): unknown {
  if (input.authType === "oauth2") {
    return {
      returnUri: OAUTH_RETURN_URI,
      ...(input.authorizationScopes ? { authorizationScopes: input.authorizationScopes } : {}),
    }
  }
  if (input.authType === "api_key") {
    return {
      apiKey: requiredSecret(input.apiKey, "apiKey"),
      ...(input.comment ? { comment: input.comment } : {}),
      ...(input.extra && Object.keys(input.extra).length ? { extra: input.extra } : {}),
    }
  }
  if (input.authType === "custom_credential") {
    if (!input.values || Object.keys(input.values).length === 0) {
      throw new ConnectionsRequestError("invalid_request", "Credential fields are required.")
    }
    return { values: input.values, ...(input.comment ? { comment: input.comment } : {}) }
  }
  return undefined
}

async function requestConnector(
  connection: ResolvedOomolConnection,
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: unknown; signal: AbortSignal },
): Promise<unknown> {
  const url = new URL(path, new URL(connection.endpoint).origin)
  const headers = new Headers(connection.headers)
  headers.set("accept", "application/json")
  const hasBody = Object.hasOwn(options, "body") && options.body !== undefined
  if (hasBody) headers.set("content-type", "application/json")

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
      signal: options.signal,
    })
  } catch (error) {
    if (options.signal.aborted) throw error
    throw new ConnectionsRequestError("unavailable", "Could not reach OOMOL Connections.")
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ConnectionsRequestError("unauthorized", "The OOMOL MCP key is invalid or lacks access.")
    }
    if (response.status === 429) throw new ConnectionsRequestError("rate_limited", "OOMOL rate limited the request.")
    if (response.status >= 500) throw new ConnectionsRequestError("unavailable", "OOMOL Connections is temporarily unavailable.")
    throw new ConnectionsRequestError("request_failed", `OOMOL rejected the request (${response.status}).`)
  }

  if (response.status === 204) return undefined
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    throw new ConnectionsRequestError("invalid_response", "OOMOL returned a non-JSON response.")
  }
  return response.json()
}

function readConnectInput(payload: unknown): ConnectInput {
  const source = requiredRecord(payload)
  const service = identifierValue(source.service, "service")
  const authType = authTypeValue(source.authType)
  const appId = source.appId === undefined ? undefined : identifierValue(source.appId, "appId")
  const comment = optionalString(source.comment, "comment", 2_000)
  const apiKey = optionalString(source.apiKey, "apiKey", MAX_CREDENTIAL_BYTES)
  const values = optionalStringRecord(source.values, "values")
  const extra = optionalStringRecord(source.extra, "extra")
  const authorizationScopes = optionalStringArray(source.authorizationScopes, "authorizationScopes")
  const secretSize = JSON.stringify({ apiKey, values, extra }).length
  if (secretSize > MAX_CREDENTIAL_BYTES) {
    throw new ConnectionsRequestError("invalid_request", "Credential payload is too large.")
  }
  return {
    service,
    authType,
    ...(appId ? { appId } : {}),
    ...(comment ? { comment } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(values ? { values } : {}),
    ...(extra ? { extra } : {}),
    ...(authorizationScopes ? { authorizationScopes } : {}),
  }
}

function sanitizeProviderListItem(value: unknown) {
  const source = recordOf(value)
  if (!source) return undefined
  const service = safeIdentifier(source.service)
  if (!service) return undefined
  const authTypes = Array.isArray(source.authTypes) ? source.authTypes.map(authTypeOrUndefined).filter(isPresent) : []
  return {
    service,
    displayName: optionalPlainString(source.displayName, 200) ?? service,
    iconUrl: optionalHttpUrl(source.iconUrl) ?? optionalHttpUrl(source.icon) ?? null,
    categories: Array.isArray(source.categories)
      ? source.categories.map((category) => {
          const item = recordOf(category)
          const id = optionalPlainString(item?.id, 120)
          if (!id) return undefined
          return { id, displayName: optionalPlainString(item?.displayName, 200) ?? id }
        }).filter(isPresent)
      : [],
    authTypes,
  }
}

function sanitizeProviderDetail(value: unknown) {
  const base = sanitizeProviderListItem(value)
  const source = recordOf(value)
  if (!base || !source) return undefined
  const apiKeyConfig = recordOf(source.apiKeyConfig)
  const customConfig = recordOf(source.customCredentialConfig)
  const oauthConfig = recordOf(source.oauthClientConfig)
  return {
    ...base,
    apiKeyConfig: apiKeyConfig
      ? {
          label: optionalPlainString(apiKeyConfig.label, 200),
          placeholder: optionalPlainString(apiKeyConfig.placeholder, 300),
          description: optionalPlainString(apiKeyConfig.description, 1_000),
          extraFields: sanitizeFields(apiKeyConfig.extraFields, true),
        }
      : null,
    customCredentialConfig: customConfig ? { fields: sanitizeFields(customConfig.fields, false) } : null,
    oauthClientConfig: oauthConfig
      ? {
          configured: oauthConfig.configured === true,
          clientConfigPolicy: oauthConfig.clientConfigPolicy === "user_required" ? "user_required" : "default_only",
          nextConnectSource: optionalPlainString(oauthConfig.nextConnectSource, 40) ?? "unconfigured",
          authorizationScopeSelection: sanitizeScopeSelection(oauthConfig.authorizationScopeSelection),
        }
      : null,
  }
}

function sanitizeFields(value: unknown, allowOptionalSecret: boolean) {
  if (!Array.isArray(value)) return []
  return value.map((field) => {
    const item = recordOf(field)
    const key = safeIdentifier(item?.key)
    if (!item || !key) return undefined
    return {
      key,
      label: optionalPlainString(item.label, 200) ?? key,
      required: item.required === true,
      secret: allowOptionalSecret ? item.secret === true : item.secret !== false,
      placeholder: optionalPlainString(item.placeholder, 300),
      description: optionalPlainString(item.description, 1_000),
    }
  }).filter(isPresent)
}

function sanitizeScopeSelection(value: unknown) {
  const source = recordOf(value)
  if (!source || !Array.isArray(source.options)) return undefined
  return {
    requiredInRequest: source.requiredInRequest === true,
    options: source.options.map((option) => {
      const item = recordOf(option)
      const scope = optionalPlainString(item?.value, 500)
      if (!item || !scope) return undefined
      return {
        value: scope,
        required: item.required === true,
        defaultSelected: item.defaultSelected === true,
        risk: ["standard", "sensitive", "destructive"].includes(String(item.risk)) ? String(item.risk) : "standard",
      }
    }).filter(isPresent),
  }
}

function sanitizeApp(value: unknown) {
  const source = recordOf(value)
  if (!source) return undefined
  const id = safeIdentifier(source.id)
  const service = safeIdentifier(source.service)
  if (!id || !service) return undefined
  const status = ["active", "reauth_required", "error", "disconnected"].includes(String(source.status))
    ? String(source.status)
    : "active"
  return {
    id,
    service,
    displayName: optionalPlainString(source.displayName, 200) ?? service,
    accountLabel: optionalPlainString(source.accountLabel, 300),
    alias: optionalPlainString(source.alias, 200),
    authType: authTypeOrUndefined(source.authType) ?? null,
    status,
    isDefault: source.isDefault === true,
    createdAt: finiteNumber(source.createdAt),
    updatedAt: finiteNumber(source.updatedAt),
  }
}

function dataOf(value: unknown): unknown {
  const envelope = recordOf(value)
  if (!envelope) throw new ConnectionsRequestError("invalid_response", "OOMOL returned an invalid response.")
  if (envelope.success === false) throw new ConnectionsRequestError("request_failed", "OOMOL rejected the request.")
  if (!("data" in envelope)) throw new ConnectionsRequestError("invalid_response", "OOMOL response did not contain data.")
  return envelope.data
}

function arrayData(value: unknown): unknown[] {
  const data = dataOf(value)
  if (!Array.isArray(data)) throw new ConnectionsRequestError("invalid_response", "OOMOL returned an invalid list.")
  return data
}

function readIdentifier(payload: unknown, key: string): string {
  return identifierValue(requiredRecord(payload)[key], key)
}

function requiredRecord(value: unknown): JsonRecord {
  const record = recordOf(value)
  if (!record) throw new ConnectionsRequestError("invalid_request", "Invalid OOMOL Connections request.")
  return record
}

function recordOf(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined
}

function identifierValue(value: unknown, key: string): string {
  const result = safeIdentifier(value)
  if (!result) throw new ConnectionsRequestError("invalid_request", `Invalid ${key}.`)
  return result
}

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : undefined
}

function authTypeValue(value: unknown): AuthType {
  const result = authTypeOrUndefined(value)
  if (!result) throw new ConnectionsRequestError("invalid_request", "Invalid connection authentication type.")
  return result
}

function authTypeOrUndefined(value: unknown): AuthType | undefined {
  return AUTH_TYPES.find((candidate) => candidate === value)
}

function optionalString(value: unknown, key: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ConnectionsRequestError("invalid_request", `Invalid ${key}.`)
  }
  return value
}

function requiredSecret(value: string | undefined, key: string): string {
  if (!value?.trim()) throw new ConnectionsRequestError("invalid_request", `${key} is required.`)
  return value
}

function optionalStringRecord(value: unknown, key: string): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined
  const source = recordOf(value)
  if (!source || Object.keys(source).length > 64) throw new ConnectionsRequestError("invalid_request", `Invalid ${key}.`)
  const result: Record<string, string> = {}
  for (const [field, fieldValue] of Object.entries(source)) {
    if (!IDENTIFIER.test(field) || typeof fieldValue !== "string") {
      throw new ConnectionsRequestError("invalid_request", `Invalid ${key}.`)
    }
    if (fieldValue !== "") result[field] = fieldValue
  }
  return result
}

function optionalStringArray(value: unknown, key: string): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.length > 256 || value.some((item) => typeof item !== "string" || item.length > 500)) {
    throw new ConnectionsRequestError("invalid_request", `Invalid ${key}.`)
  }
  return [...new Set(value)]
}

function optionalPlainString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" && value.length <= maxLength && value.trim() ? value.trim() : undefined
}

function optionalHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 4_096) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined
}

function rpcError(code: string, message: string) {
  return { ok: false as const, error: { code: "internal" as const, message, details: { reason: code } } }
}

class ConnectionsRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = "ConnectionsRequestError"
  }
}
