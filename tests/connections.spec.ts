import { afterEach, describe, expect, it, vi } from "vitest"

import { createConnectionsRpcHandler } from "../src/connections.js"
import type { ResolvedOomolConnection } from "../src/runtime.js"

const connection: ResolvedOomolConnection = {
  mode: "oomol-hosted",
  endpoint: "https://connector.oomol.com/v1/mcp",
  apiKeyEnv: "OOMOL_MCP_API_KEY",
  headers: {
    Authorization: "Bearer api-secret",
    "x-oo-team-name": "example-team",
  },
  serverName: "oomol",
  consoleUrl: "https://connector.oomol.com",
  toolCallTimeoutMs: 60_000,
  failOnStartupError: false,
}

const signal = new AbortController().signal

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("OOMOL Connections RPC", () => {
  it("lists sanitized Providers and apps without returning credential material", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === "/v1/providers") {
        return json({
          success: true,
          data: [{
            service: "github",
            displayName: "GitHub",
            iconUrl: "javascript:alert(1)",
            authTypes: ["oauth2"],
            categories: [{ id: "developer", displayName: "Developer" }],
            secret: "must-not-cross-rpc",
          }],
        })
      }
      return json({
        success: true,
        data: [{
          id: "app_123",
          service: "github",
          displayName: "GitHub",
          providerAccountId: "github:octocat",
          accountLabel: "octocat",
          authType: "oauth2",
          status: "active",
          credential: { accessToken: "provider-secret" },
          createdAt: 1,
          updatedAt: 2,
        }],
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/list", {}, signal)

    expect(response).toEqual({
      ok: true,
      value: {
        providers: [{
          service: "github",
          displayName: "GitHub",
          iconUrl: null,
          authTypes: ["oauth2"],
          categories: [{ id: "developer", displayName: "Developer" }],
        }],
        apps: [{
          id: "app_123",
          service: "github",
          displayName: "GitHub",
          providerAccountId: "github:octocat",
          accountLabel: "octocat",
          authType: "oauth2",
          status: "active",
          isDefault: false,
          createdAt: 1,
          updatedAt: 2,
        }],
      },
    })
    for (const call of fetchMock.mock.calls) {
      const headers = new Headers(call[1]?.headers)
      expect(headers.get("authorization")).toBe("Bearer api-secret")
      expect(headers.get("x-oo-team-name")).toBe("example-team")
    }
    expect(JSON.stringify(response)).not.toContain("provider-secret")
    expect(JSON.stringify(response)).not.toContain("must-not-cross-rpc")
    expect(JSON.stringify(response)).not.toContain("api-secret")
  })

  it("sends Provider credentials directly from the loopback RPC to Connector", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST")
      expect(JSON.parse(String(init?.body))).toEqual({
        apiKey: "provider-api-key",
        comment: "work account",
        extra: { region: "eu" },
      })
      return json({
        success: true,
        data: {
          id: "app_456",
          service: "example",
          displayName: "Example",
          authType: "api_key",
          status: "active",
          providerSecret: "not-returned",
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/connect", {
      service: "example",
      authType: "api_key",
      apiKey: "provider-api-key",
      comment: "work account",
      extra: { region: "eu" },
    }, signal)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://connector.oomol.com/v1/apps/example/connect/api-key")
    expect(response).toEqual({
      ok: true,
      value: {
        app: {
          id: "app_456",
          service: "example",
          displayName: "Example",
          authType: "api_key",
          status: "active",
          isDefault: false,
        },
      },
    })
    expect(JSON.stringify(response)).not.toContain("provider-api-key")
    expect(JSON.stringify(response)).not.toContain("not-returned")
  })

  it("reconnects one existing app through its appId-scoped route", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST")
      expect(JSON.parse(String(init?.body))).toEqual({ apiKey: "replacement-key" })
      return json({
        success: true,
        data: {
          id: "app_456",
          service: "example",
          displayName: "Example",
          authType: "api_key",
          status: "active",
          isDefault: true,
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/connect", {
      service: "example",
      appId: "app_456",
      authType: "api_key",
      apiKey: "replacement-key",
    }, signal)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://connector.oomol.com/v1/apps/by-id/app_456/connect/api-key",
    )
    expect(response).toMatchObject({ ok: true, value: { app: { id: "app_456", isDefault: true } } })
    expect(JSON.stringify(response)).not.toContain("replacement-key")
  })

  it("uses a fixed Console callback for OAuth and validates identifiers before fetching", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toEqual({
        returnUri: "https://console.oomol.com/app-connections/callback",
        authorizationOptionIds: ["read:user", "repo"],
      })
      expect(Object.hasOwn(body, "authorizationScopes")).toBe(false)
      return json({ success: true, data: { authorizationUrl: "https://github.com/login/oauth/authorize?id=1" } })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const oauth = await handler("connections/connect", {
      service: "github",
      authType: "oauth2",
      authorizationOptionIds: ["read:user", "repo", "repo"],
    }, signal)
    expect(oauth).toEqual({
      ok: true,
      value: { authorizationUrl: "https://github.com/login/oauth/authorize?id=1" },
    })

    const invalid = await handler("connections/provider", { service: "../../api-keys" }, signal)
    expect(invalid.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("sends an explicit empty authorization option selection and omits it only for Providers without options", async () => {
    const bodies: unknown[] = []
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === "/v1/providers/slack") {
        return json({ success: true, data: { service: "slack", displayName: "Slack", authTypes: ["oauth2"], oauthClientConfig: {} } })
      }
      bodies.push(JSON.parse(String(init?.body)))
      return json({ success: true, data: { authorizationUrl: "https://example.com/oauth" } })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    await handler("connections/connect", { service: "github", authType: "oauth2", authorizationOptionIds: [] }, signal)
    await handler("connections/connect", { service: "slack", authType: "oauth2" }, signal)

    expect(bodies).toEqual([
      { returnUri: "https://console.oomol.com/app-connections/callback", authorizationOptionIds: [] },
      { returnUri: "https://console.oomol.com/app-connections/callback" },
    ])
  })

  it("separates an invalid key from a team role that cannot manage connections", async () => {
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })))
    expect(await handler("connections/disconnect", { appId: "app_1" }, signal)).toEqual({ ok: false, error: { reason: "unauthorized" } })

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 403 })))
    expect(await handler("connections/disconnect", { appId: "app_1" }, signal)).toEqual({ ok: false, error: { reason: "forbidden" } })
  })

  it("refuses an OAuth request without a selection when the Provider declares options", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname === "/v1/providers/github") {
        return json({
          success: true,
          data: {
            service: "github",
            displayName: "GitHub",
            authTypes: ["oauth2"],
            // An id the Host filters out must not turn into an implicit "grant everything".
            oauthClientConfig: { authorizationOptions: [{ id: "admin org", label: "Admin", risk: "destructive" }] },
          },
        })
      }
      return json({ success: true, data: { authorizationUrl: "https://example.com/oauth" } })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/connect", { service: "github", authType: "oauth2" }, signal)

    expect(response).toEqual({ ok: false, error: { reason: "invalid_request" } })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("rejects retired, malformed, or misplaced authorization options before fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const payloads = [
      { service: "github", authType: "oauth2", authorizationScopes: ["read:user"] },
      { service: "github", authType: "oauth2", authorizationOptionIds: ["read user"] },
      { service: "github", authType: "oauth2", authorizationOptionIds: [""] },
      { service: "github", authType: "oauth2", authorizationOptionIds: "read:user" },
      { service: "github", authType: "oauth2", authorizationOptionIds: [1] },
      { service: "example", authType: "api_key", apiKey: "key", authorizationOptionIds: ["read:user"] },
    ]
    for (const payload of payloads) {
      const response = await handler("connections/connect", payload, signal)
      expect(response).toEqual({ ok: false, error: { reason: "invalid_request" } })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sanitizes Provider authorization options", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      success: true,
      data: {
        service: "github",
        displayName: "GitHub",
        authTypes: ["oauth2"],
        oauthClientConfig: {
          configured: true,
          clientConfigPolicy: "default_only",
          nextConnectSource: "default",
          authorizationScopeSelection: { requiredInRequest: true, options: [{ value: "legacy" }] },
          authorizationOptions: [
            {
              id: "read:user",
              label: "Read profile",
              description: "Identify the GitHub account.",
              required: true,
              defaultSelected: true,
              risk: "standard",
            },
            {
              id: "workflow",
              label: "Workflows",
              description: "Update GitHub Actions workflows.",
              required: false,
              defaultSelected: false,
              risk: "sensitive",
              requires: ["repo", "repo", "workflow", "bad id"],
            },
            { id: "delete_repo", label: "Delete repositories", required: false, defaultSelected: false, risk: "destructive" },
            { id: "custom", label: "Custom", risk: "unknown" },
            { id: "bad id", label: "Invalid" },
            { id: "read:user", label: "Duplicate" },
            { label: "Missing id" },
          ],
        },
      },
    })))
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/provider", { service: "github" }, signal)

    expect(response.ok).toBe(true)
    const value = (response as { value: { oauthClientConfig: Record<string, unknown> } }).value
    expect(value.oauthClientConfig).not.toHaveProperty("authorizationScopeSelection")
    expect(value.oauthClientConfig.authorizationOptions).toEqual([
      {
        id: "read:user",
        label: "Read profile",
        description: "Identify the GitHub account.",
        required: true,
        defaultSelected: true,
        risk: "standard",
      },
      {
        id: "workflow",
        label: "Workflows",
        description: "Update GitHub Actions workflows.",
        required: false,
        defaultSelected: false,
        risk: "sensitive",
        requires: ["repo"],
      },
      { id: "delete_repo", label: "Delete repositories", required: false, defaultSelected: false, risk: "destructive" },
      { id: "custom", label: "Custom", required: false, defaultSelected: false, risk: "standard" },
    ])
  })

  it("omits authorization options when the Provider declares none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      success: true,
      data: {
        service: "slack",
        authTypes: ["oauth2"],
        oauthClientConfig: { configured: true, clientConfigPolicy: "default_only", nextConnectSource: "default" },
      },
    })))
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/provider", { service: "slack" }, signal)

    expect(response).toMatchObject({ ok: true })
    expect((response as { value: { oauthClientConfig: object } }).value.oauthClientConfig)
      .not.toHaveProperty("authorizationOptions")
  })

  it("keeps virtual no-auth and Marketplace apps from the list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (new URL(String(input)).pathname === "/v1/providers") return json({ success: true, data: [] })
      return json({
        success: true,
        data: [
          { id: "no_auth:weather", service: "weather", authType: "no_auth", status: "active" },
          { id: "marketplace:oomol:search", service: "search", authType: "marketplace", status: "active", isDefault: true },
          { id: "no_auth:weather", service: "other", status: "active" },
          { id: "marketplace:oomol:search", service: "other", status: "active" },
          { id: "marketplace:search", service: "search", status: "active" },
          { id: "unknown:weather", service: "weather", status: "active" },
          { id: "no_auth:../weather", service: "weather", status: "active" },
          { id: "app_1", service: "github", status: "active", providerScopes: ["read:user", "repo", "bad scope"] },
        ],
      })
    }))
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/list", {}, signal)

    expect(response).toMatchObject({
      ok: true,
      value: {
        apps: [
          { id: "no_auth:weather", service: "weather", authType: "no_auth", isDefault: false },
          { id: "marketplace:oomol:search", service: "search", authType: null, isDefault: true },
          { id: "app_1", service: "github", providerScopes: ["read:user", "repo"] },
        ],
      },
    })
    expect((response as { value: { apps: unknown[] } }).value.apps).toHaveLength(3)
  })

  it("rejects virtual app ids for app-scoped routes before fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const responses = [
      await handler("connections/disconnect", { appId: "no_auth:weather" }, signal),
      await handler("connections/disconnect", { appId: "marketplace:oomol:search" }, signal),
      await handler("connections/connect", { service: "search", appId: "marketplace:oomol:search", authType: "api_key", apiKey: "key" }, signal),
      await handler("connections/connect", { service: "weather", appId: "no_auth:weather", authType: "oauth2" }, signal),
      await handler("connections/set-default", { service: "weather", appId: "no_auth:weather" }, signal),
      await handler("connections/set-default", { service: "other", appId: "marketplace:oomol:search" }, signal),
    ]

    for (const response of responses) expect(response).toEqual({ ok: false, error: { reason: "invalid_request" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sets a Marketplace virtual app as the service default", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ appId: "marketplace:oomol:search" })
      return json({
        success: true,
        data: { id: "marketplace:oomol:search", service: "search", status: "active", isDefault: true },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/set-default", {
      service: "search",
      appId: "marketplace:oomol:search",
    }, signal)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://connector.oomol.com/v1/apps/services/search/default")
    expect(response).toMatchObject({ ok: true, value: { id: "marketplace:oomol:search", isDefault: true } })
  })

  it("routes no-auth connections to the service route even with an appId", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST")
      expect(init?.body).toBeUndefined()
      expect(new Headers(init?.headers).has("content-type")).toBe(false)
      return json({
        success: true,
        data: { id: "no_auth:weather", service: "weather", authType: "no_auth", status: "active" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const fresh = await handler("connections/connect", { service: "weather", authType: "no_auth" }, signal)
    const withAppId = await handler("connections/connect", { service: "weather", appId: "app_1", authType: "no_auth" }, signal)

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://connector.oomol.com/v1/apps/weather/connect/no-auth",
      "https://connector.oomol.com/v1/apps/weather/connect/no-auth",
    ])
    expect(fresh).toMatchObject({ ok: true, value: { app: { id: "no_auth:weather" } } })
    expect(withAppId).toMatchObject({ ok: true, value: { app: { id: "no_auth:weather" } } })
  })

  it("disconnects an app without sending a request body", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      json({ success: true, data: { disconnected: true } }))
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/disconnect", { appId: "app_456" }, signal)

    const [input, init] = fetchMock.mock.calls[0] ?? []
    expect(String(input)).toBe("https://connector.oomol.com/v1/apps/by-id/app_456")
    expect(init?.method).toBe("DELETE")
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).has("content-type")).toBe(false)
    expect(response).toEqual({ ok: true, value: { disconnected: true } })
  })

  it("sets one sanitized app as the service default", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("PUT")
      expect(JSON.parse(String(init?.body))).toEqual({ appId: "app_456" })
      return json({
        success: true,
        data: {
          id: "app_456",
          service: "github",
          displayName: "GitHub",
          accountLabel: "work@example.com",
          isDefault: true,
          authType: "oauth2",
          status: "active",
          credential: { accessToken: "must-not-cross-rpc" },
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const response = await handler("connections/set-default", {
      service: "github",
      appId: "app_456",
    }, signal)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://connector.oomol.com/v1/apps/services/github/default",
    )
    expect(response).toEqual({
      ok: true,
      value: {
        id: "app_456",
        service: "github",
        displayName: "GitHub",
        accountLabel: "work@example.com",
        isDefault: true,
        authType: "oauth2",
        status: "active",
      },
    })
    expect(JSON.stringify(response)).not.toContain("must-not-cross-rpc")
  })

  it("returns an unconfigured state without making a network request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => undefined })

    const response = await handler("connections/list", {}, signal)

    expect(response).toMatchObject({ ok: false, error: { reason: "unconfigured" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("directs self-hosted connection management to OpenConnector Console", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({
      resolveConnection: async () => ({
        ...connection,
        mode: "self-hosted",
        endpoint: "http://127.0.0.1:3006/mcp",
        apiKeyEnv: "OOMOL_CONNECT_RUNTIME_TOKEN",
        consoleUrl: "http://127.0.0.1:3006",
      }),
    })

    const response = await handler("connections/list", {}, signal)

    expect(response).toMatchObject({ ok: false, error: { reason: "unsupported" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
