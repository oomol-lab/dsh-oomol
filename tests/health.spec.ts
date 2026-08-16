import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { createServer } from "node:http"
import { describe, expect, it } from "vitest"

import { probeOomolConnection, statusFromProbeError } from "../src/health.js"

describe("statusFromProbeError", () => {
  const checkedAt = "2026-08-16T00:00:00.000Z"

  it.each([401, 403])("maps HTTP %s to a credential-safe unauthorized state", (code) => {
    expect(statusFromProbeError(new StreamableHTTPError(code, "secret response"), checkedAt)).toEqual({
      phase: "unauthorized",
      checkedAt,
      errorCode: "unauthorized",
    })
  })

  it("maps rate limiting without exposing the server response", () => {
    expect(statusFromProbeError(new StreamableHTTPError(429, "sensitive detail"), checkedAt)).toEqual({
      phase: "rate-limited",
      checkedAt,
      errorCode: "rate-limited",
    })
  })

  it("distinguishes timeouts from other availability failures", () => {
    expect(statusFromProbeError(new Error("Request timed out"), checkedAt)).toEqual({
      phase: "unavailable",
      checkedAt,
      errorCode: "timeout",
    })
    expect(statusFromProbeError(new Error("api_key_should_not_escape"), checkedAt)).toEqual({
      phase: "unavailable",
      checkedAt,
      errorCode: "unavailable",
    })
  })
})

describe("probeOomolConnection", () => {
  it("sends the resolved authorization and team headers without returning them", async () => {
    let receivedExpectedAuthorization = false
    let receivedExpectedTeam = false
    const server = createServer((request, response) => {
      receivedExpectedAuthorization = request.headers.authorization === "Bearer test-only-key"
      receivedExpectedTeam = request.headers["x-oo-team-name"] === "test-team"
      response.writeHead(401, { "content-type": "application/json" })
      response.end(JSON.stringify({ error: "unauthorized" }))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

    try {
      const address = server.address()
      if (address === null || typeof address === "string") throw new Error("test server did not bind")
      await expect(probeOomolConnection({
        endpoint: `http://127.0.0.1:${address.port}/mcp`,
        headers: {
          Authorization: "Bearer test-only-key",
          "x-oo-team-name": "test-team",
        },
        serverName: "oomol",
        toolCallTimeoutMs: 1_000,
        failOnStartupError: false,
      }, 1_000)).rejects.toBeDefined()
      expect(receivedExpectedAuthorization).toBe(true)
      expect(receivedExpectedTeam).toBe(true)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
