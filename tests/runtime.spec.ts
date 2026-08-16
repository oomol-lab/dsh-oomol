import { describe, expect, it } from "vitest"

import {
  DEFAULT_MCP_ENDPOINT,
  normalizeMcpEndpoint,
  resolveOomolConnection,
  resolveOomolConnectionIfConfigured,
} from "../src/runtime.js"

describe("resolveOomolConnection", () => {
  it("prefers a Harness credential and adds an explicit team header", async () => {
    const result = await resolveOomolConnection(
      { teamName: "Acme" },
      {
        readCredential: async () => "credential-key",
        readEnvironment: () => "environment-key",
      },
    )

    expect(result).toEqual({
      endpoint: DEFAULT_MCP_ENDPOINT,
      failOnStartupError: false,
      headers: {
        Authorization: "Bearer credential-key",
        "x-oo-team-name": "Acme",
      },
      serverName: "oomol",
      toolCallTimeoutMs: 60_000,
    })
  })

  it("uses environment values and omits the team header for personal identity", async () => {
    const result = await resolveOomolConnection(
      {},
      {
        readCredential: async () => undefined,
        readEnvironment: (name) => (name === "OOMOL_MCP_API_KEY" ? "api-key" : undefined),
      },
    )

    expect(result.headers).toEqual({ Authorization: "Bearer api-key" })
  })

  it("fails with an actionable message when no API key is available", async () => {
    await expect(
      resolveOomolConnection(
        {},
        {
          readCredential: async () => undefined,
          readEnvironment: () => undefined,
        },
      ),
    ).rejects.toThrow("OOMOL_MCP_API_KEY")
  })

  it("treats an unconfigured connection as a normal optional state", async () => {
    await expect(
      resolveOomolConnectionIfConfigured(
        {},
        {
          readCredential: async () => undefined,
          readEnvironment: () => undefined,
        },
      ),
    ).resolves.toBeUndefined()
  })

  it("rejects unsafe endpoint credentials", () => {
    expect(() => normalizeMcpEndpoint("https://user:password@connector.example.com/mcp")).toThrow(
      "must not contain credentials",
    )
  })

  it("validates the MCP namespace and timeout", async () => {
    const runtime = {
      readCredential: async () => "api-key",
      readEnvironment: () => undefined,
    }

    await expect(resolveOomolConnection({ serverName: "invalid name" }, runtime)).rejects.toThrow("serverName")
    await expect(resolveOomolConnection({ toolCallTimeoutMs: 0 }, runtime)).rejects.toThrow(
      "positive safe integer",
    )
  })

  it("validates credential reference names before reading them", async () => {
    await expect(
      resolveOomolConnectionIfConfigured(
        { apiKeyEnv: "not a reference" },
        {
          readCredential: async () => "api-key",
          readEnvironment: () => undefined,
        },
      ),
    ).rejects.toThrow("apiKeyEnv")
  })
})
