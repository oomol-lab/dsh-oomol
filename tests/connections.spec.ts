import { afterEach, describe, expect, it, vi } from "vitest"

import { createConnectionsRpcHandler } from "../src/connections.js"
import type { ResolvedOomolConnection } from "../src/runtime.js"

const connection: ResolvedOomolConnection = {
  endpoint: "https://connector.oomol.com/v1/mcp",
  headers: {
    Authorization: "Bearer api-secret",
    "x-oo-team-name": "example-team",
  },
  serverName: "oomol",
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
      expect(JSON.parse(String(init?.body))).toEqual({
        returnUri: "https://console.oomol.com/app-connections/callback",
        authorizationScopes: ["read:user"],
      })
      return json({ success: true, data: { authorizationUrl: "https://github.com/login/oauth/authorize?id=1" } })
    })
    vi.stubGlobal("fetch", fetchMock)
    const handler = createConnectionsRpcHandler({ resolveConnection: async () => connection })

    const oauth = await handler("connections/connect", {
      service: "github",
      authType: "oauth2",
      authorizationScopes: ["read:user"],
    }, signal)
    expect(oauth).toEqual({
      ok: true,
      value: { authorizationUrl: "https://github.com/login/oauth/authorize?id=1" },
    })

    const invalid = await handler("connections/provider", { service: "../../api-keys" }, signal)
    expect(invalid.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
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
})

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
