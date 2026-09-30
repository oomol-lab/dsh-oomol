import type { ResolvedOomolConnection } from "./runtime.js"

const AUTH_TYPES = ["oauth2", "api_key", "custom_credential", "federated", "no_auth"] as const
const IDENTIFIER = /^[A-Za-z0-9_-]{1,160}$/
// Connector exposes virtual no-auth and Marketplace apps in GET /v1/apps. They have no stored app row,
// so by-id routes (disconnect, reconnect) reject them; only Marketplace ids can become the default.
const VIRTUAL_APP_ID = /^(?:no_auth:([A-Za-z0-9_-]{1,160})|marketplace:[A-Za-z0-9_-]{1,160}:([A-Za-z0-9_-]{1,160}))$/
const MARKETPLACE_APP_ID = /^marketplace:[A-Za-z0-9_-]{1,160}:[A-Za-z0-9_-]{1,160}$/
// OAuth authorization option ids default to native scopes (for example `read:user` or scope URLs).
const AUTHORIZATION_OPTION_ID = /^[\x21-\x7E]{1,500}$/
const MAX_AUTHORIZATION_OPTIONS = 64
const AUTHORIZATION_RISKS = ["standard", "sensitive", "destructive"] as const
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
      if (connection.mode !== "oomol-hosted") {
        return rpcError("unsupported", "Manage self-hosted connections in OpenConnector Console.")
      }

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
        if (input.authType === "oauth2") await assertAuthorizationSelection(connection, input, signal)
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
          signal,
        })
        return { ok: true as const, value: { disconnected: true } }
      }

      if (endpoint === "connections/set-default") {
        const service = readIdentifier(payload, "service")
        const appId = readDefaultAppId(payload, service)
        const response = await requestConnector(
          connection,
          `/v1/apps/services/${encodeURIComponent(service)}/default`,
          {
            method: "PUT",
            body: { appId },
            signal,
          },
        )
        const app = sanitizeApp(dataOf(response))
        if (!app) throw new ConnectionsRequestError("invalid_response", "OOMOL returned an invalid App.")
        return { ok: true as const, value: app }
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
  authorizationOptionIds?: string[]
}

/**
 * Connector grants every declared authorization option when a request omits
 * the selection, so the Host checks the Provider itself instead of trusting a
 * possibly stale or filtered client view.
 */
async function assertAuthorizationSelection(
  connection: ResolvedOomolConnection,
  input: ConnectInput,
  signal: AbortSignal,
): Promise<void> {
  if (input.authorizationOptionIds) return
  const provider = recordOf(dataOf(
    await requestConnector(connection, `/v1/providers/${encodeURIComponent(input.service)}`, { signal }),
  ))
  const declared = recordOf(provider?.oauthClientConfig)?.authorizationOptions
  if (Array.isArray(declared) && declared.length > 0) {
    throw new ConnectionsRequestError("invalid_request", "Select the OAuth authorization options first.")
  }
}

function connectPath(input: ConnectInput): string {
  // Connector only has a service-scoped no-auth route with create-or-reuse semantics.
  if (input.authType === "no_auth") return `/v1/apps/${encodeURIComponent(input.service)}/connect/no-auth`
  const root = input.appId
    ? `/v1/apps/by-id/${encodeURIComponent(input.appId)}/connect`
    : `/v1/apps/${encodeURIComponent(input.service)}/connect`
  if (input.authType === "oauth2") return root
  if (input.authType === "api_key") return `${root}/api-key`
  if (input.authType === "custom_credential") return `${root}/custom-credential`
  throw new ConnectionsRequestError("unsupported", "Federated connections are not available in this preview.")
}

function connectBody(input: ConnectInput): unknown {
  if (input.authType === "oauth2") {
    return {
      returnUri: OAUTH_RETURN_URI,
      ...(input.authorizationOptionIds ? { authorizationOptionIds: input.authorizationOptionIds } : {}),
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
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal: AbortSignal },
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
    if (response.status === 401) {
      throw new ConnectionsRequestError("unauthorized", "The OOMOL MCP key is invalid or lacks access.")
    }
    // Connector answers 403 when the key is valid but the team role cannot manage connections.
    if (response.status === 403) throw new ConnectionsRequestError("forbidden", "The team role cannot manage connections.")
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
  // Connector silently drops the retired field and would then request every option, so refuse it.
  if (Object.hasOwn(source, "authorizationScopes")) {
    throw new ConnectionsRequestError("invalid_request", "authorizationScopes is no longer supported.")
  }
  const authorizationOptionIds = optionalAuthorizationOptionIds(source.authorizationOptionIds)
  if (authorizationOptionIds && authType !== "oauth2") {
    throw new ConnectionsRequestError("invalid_request", "Authorization options require OAuth.")
  }
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
    ...(authorizationOptionIds ? { authorizationOptionIds } : {}),
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
          ...sanitizeAuthorizationOptions(oauthConfig.authorizationOptions),
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

function sanitizeAuthorizationOptions(value: unknown) {
  if (!Array.isArray(value)) return {}
  const seen = new Set<string>()
  const options = value.slice(0, MAX_AUTHORIZATION_OPTIONS).map((option) => {
    const item = recordOf(option)
    const id = safeAuthorizationOptionId(item?.id)
    if (!item || !id || seen.has(id)) return undefined
    seen.add(id)
    const requires = Array.isArray(item.requires)
      ? [...new Set(item.requires.map(safeAuthorizationOptionId).filter(isPresent))].filter((requiredId) => requiredId !== id)
      : []
    return {
      id,
      label: optionalPlainString(item.label, 200) ?? id,
      description: optionalPlainString(item.description, 1_000),
      required: item.required === true,
      defaultSelected: item.defaultSelected === true,
      risk: AUTHORIZATION_RISKS.find((risk) => risk === item.risk) ?? "standard",
      ...(requires.length ? { requires } : {}),
    }
  }).filter(isPresent)
  return options.length ? { authorizationOptions: options } : {}
}

function sanitizeApp(value: unknown) {
  const source = recordOf(value)
  if (!source) return undefined
  const service = safeIdentifier(source.service)
  const id = service ? safeAppId(source.id, service) : undefined
  if (!id || !service) return undefined
  const status = ["active", "reauth_required", "error", "disconnected"].includes(String(source.status))
    ? String(source.status)
    : "active"
  return {
    id,
    service,
    displayName: optionalPlainString(source.displayName, 200) ?? service,
    providerAccountId: optionalPlainString(source.providerAccountId, 300),
    accountLabel: optionalPlainString(source.accountLabel, 300),
    alias: optionalPlainString(source.alias, 200),
    authType: authTypeOrUndefined(source.authType) ?? null,
    status,
    isDefault: source.isDefault === true,
    providerScopes: optionalScopeList(source.providerScopes),
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

function readDefaultAppId(payload: unknown, service: string): string {
  const value = requiredRecord(payload).appId
  if (typeof value === "string" && MARKETPLACE_APP_ID.test(value) && value.endsWith(`:${service}`)) return value
  return identifierValue(value, "appId")
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

function safeAppId(value: unknown, service: string): string | undefined {
  if (typeof value !== "string") return undefined
  if (IDENTIFIER.test(value)) return value
  const match = VIRTUAL_APP_ID.exec(value)
  return match && (match[1] ?? match[2]) === service ? value : undefined
}

function safeAuthorizationOptionId(value: unknown): string | undefined {
  return typeof value === "string" && AUTHORIZATION_OPTION_ID.test(value) ? value : undefined
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

function optionalAuthorizationOptionIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.length > MAX_AUTHORIZATION_OPTIONS
    || value.some((item) => safeAuthorizationOptionId(item) === undefined)) {
    throw new ConnectionsRequestError("invalid_request", "Invalid authorizationOptionIds.")
  }
  return [...new Set(value as string[])]
}

function optionalScopeList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return [...new Set(value.slice(0, 256).map(safeAuthorizationOptionId).filter(isPresent))]
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

function rpcError(code: string, _message: string) {
  return { ok: false as const, error: { reason: code } }
}

class ConnectionsRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = "ConnectionsRequestError"
  }
}
