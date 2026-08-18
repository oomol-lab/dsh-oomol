import { describe, expect, it } from "vitest"

import {
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_SELF_HOSTED_API_KEY_ENV,
  connectorModeFromEndpoint,
  normalizeMcpEndpoint,
  resolveConnectorConfiguration,
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
      mode: "oomol-hosted",
      endpoint: DEFAULT_MCP_ENDPOINT,
      apiKeyEnv: "OOMOL_MCP_API_KEY",
      failOnStartupError: false,
      headers: {
        Authorization: "Bearer credential-key",
        "x-oo-team-name": "Acme",
      },
      consoleUrl: "https://connector.oomol.com",
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

  it("connects to self-hosted MCP without a runtime API key", async () => {
    const result = await resolveOomolConnectionIfConfigured(
      { endpoint: "http://127.0.0.1:3006/mcp" },
      {
        readCredential: async () => undefined,
        readEnvironment: () => undefined,
      },
    )

    expect(result).toMatchObject({
      mode: "self-hosted",
      apiKeyEnv: DEFAULT_SELF_HOSTED_API_KEY_ENV,
      headers: {},
      consoleUrl: "http://127.0.0.1:3006",
    })
  })

  it("uses a self-hosted runtime API key as a Bearer credential", async () => {
    const result = await resolveOomolConnection(
      { endpoint: "https://connect.example.com/mcp" },
      {
        readCredential: async (name) => name === DEFAULT_SELF_HOSTED_API_KEY_ENV ? "oct_runtime" : undefined,
        readEnvironment: () => undefined,
      },
    )

    expect(result.headers).toEqual({ Authorization: "Bearer oct_runtime" })
  })

  it("derives the deployment mode and safe client configuration", () => {
    expect(connectorModeFromEndpoint(`${DEFAULT_MCP_ENDPOINT}/`)).toBe("oomol-hosted")
    expect(resolveConnectorConfiguration({ endpoint: "https://connect.example.com/mcp" })).toEqual({
      mode: "self-hosted",
      endpoint: "https://connect.example.com/mcp",
      apiKeyEnv: DEFAULT_SELF_HOSTED_API_KEY_ENV,
      credentialRequired: false,
      connectionsManagement: "external",
      consoleUrl: "https://connect.example.com",
    })
  })

  it("rejects unsafe endpoint credentials", () => {
    expect(() => normalizeMcpEndpoint("https://user:password@connector.example.com/mcp")).toThrow(
      "must not contain credentials",
    )
  })

  it("restricts plain HTTP endpoints to loopback hosts", () => {
    expect(() => normalizeMcpEndpoint("http://connect.example.com/mcp")).toThrow("loopback")
    expect(normalizeMcpEndpoint("http://localhost:3006/mcp")).toBe("http://localhost:3006/mcp")
    expect(normalizeMcpEndpoint("http://127.0.0.2:3006/mcp")).toBe("http://127.0.0.2:3006/mcp")
    expect(normalizeMcpEndpoint("http://[::1]:3006/mcp")).toBe("http://[::1]:3006/mcp")
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
