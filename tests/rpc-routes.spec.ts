import { describe, expect, it, vi } from "vitest"

import { createOomolApi } from "../src/client/oomol-api.js"
import { createOomolFetchRoutes, OOMOL_ENDPOINTS } from "../src/rpc-routes.js"

describe("OOMOL Host routes", () => {
  it("registers one exact POST route below /api per operation", () => {
    const routes = createOomolFetchRoutes(async () => ({ ok: true, value: null }))

    expect(routes.map((route) => route.path)).toEqual(OOMOL_ENDPOINTS.map((endpoint) => `/api/oomol/${endpoint}`))
    for (const route of routes) {
      expect(route.methods).toEqual(["POST"])
      expect(route.requestBody).toBe("buffered")
      for (const segment of route.path.slice("/api/".length).split("/")) {
        expect(segment).toMatch(/^[A-Za-z0-9_$.-]+$/)
      }
    }
  })

  it("passes the JSON payload to the handler and returns its result", async () => {
    const handler = vi.fn(async () => ({ ok: true as const, value: { providers: [] } }))
    const route = createOomolFetchRoutes(handler).find((entry) => entry.path === "/api/oomol/connections/list")!

    const response = await route.fetch(new Request("http://127.0.0.1/api/oomol/connections/list", {
      method: "POST",
      body: JSON.stringify({ force: true }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, value: { providers: [] } })
    expect(handler).toHaveBeenCalledWith("connections/list", { force: true }, expect.any(AbortSignal))
  })

  it("rejects malformed JSON before reaching the handler", async () => {
    const handler = vi.fn(async () => ({ ok: true as const, value: null }))
    const route = createOomolFetchRoutes(handler)[0]!

    const response = await route.fetch(new Request("http://127.0.0.1/api/oomol/configuration", { method: "POST", body: "{" }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "invalid_request" } })
    expect(handler).not.toHaveBeenCalled()
  })

  it("hides Host error details from the browser", async () => {
    const onError = vi.fn()
    const route = createOomolFetchRoutes(async () => {
      throw new Error("Bearer api_secret_value")
    }, onError)[0]!

    const response = await route.fetch(new Request("http://127.0.0.1/api/oomol/configuration", { method: "POST" }))
    const text = await response.text()

    expect(response.status).toBe(500)
    expect(text).not.toContain("api_secret_value")
    expect(onError).toHaveBeenCalledWith("configuration", expect.any(Error))
  })
})

describe("OOMOL browser API", () => {
  it("posts JSON to the document-relative route and returns the envelope", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, value: "done" }))
    const api = createOomolApi(fetchImpl, () => "http://127.0.0.1:47811/harness/")

    await expect(api.call("connections/provider", { service: "github" })).resolves.toEqual({ ok: true, value: "done" })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe("http://127.0.0.1:47811/harness/api/oomol/connections/provider")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ service: "github" }))
    expect(init.credentials).toBe("same-origin")
  })

  it("throws on transport failures without an envelope", async () => {
    const api = createOomolApi(async () => new Response("unauthorized", { status: 401 }), () => "http://127.0.0.1/")

    await expect(api.call("status")).rejects.toThrow("HTTP 401")
  })
})
