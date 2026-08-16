import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"

import type { ResolvedOomolConnection } from "./runtime.js"

export type OomolConnectionPhase =
  | "unconfigured"
  | "connecting"
  | "connected"
  | "unauthorized"
  | "rate-limited"
  | "unavailable"

export interface OomolConnectionStatus {
  phase: OomolConnectionPhase
  checkedAt?: string
  errorCode?: "unauthorized" | "rate-limited" | "timeout" | "unavailable"
  serverName?: string
  serverVersion?: string
  toolCount?: number
}

export interface OomolProbeResult {
  serverName?: string
  serverVersion?: string
  toolCount: number
}

/**
 * Open a short-lived MCP session and verify both initialization and the first
 * progressive-discovery tool page. The caller supplies the already-resolved
 * credential; no credential value is included in the result or error status.
 */
export async function probeOomolConnection(
  connection: ResolvedOomolConnection,
  timeoutMs = Math.min(connection.toolCallTimeoutMs, 15_000),
): Promise<OomolProbeResult> {
  const client = new Client({ name: "dsh-oomol-health", version: "0.1.0" })
  const transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), {
    requestInit: { headers: connection.headers },
  })

  try {
    // SDK 1.30's exact-optional declarations expose sessionId differently on
    // the concrete class and Transport interface even though the runtime
    // implementation satisfies the protocol.
    await client.connect(transport as unknown as Transport, { timeout: timeoutMs })
    const tools = await client.listTools(undefined, { timeout: timeoutMs })
    const server = client.getServerVersion()
    return {
      ...(server?.name ? { serverName: server.name } : {}),
      ...(server?.version ? { serverVersion: server.version } : {}),
      toolCount: tools.tools.length,
    }
  } finally {
    await client.close().catch(() => undefined)
  }
}

export function statusFromProbeError(error: unknown, checkedAt = new Date().toISOString()): OomolConnectionStatus {
  const httpCode = error instanceof StreamableHTTPError ? error.code : numericCode(error)
  if (httpCode === 401 || httpCode === 403) {
    return { phase: "unauthorized", checkedAt, errorCode: "unauthorized" }
  }
  if (httpCode === 429) {
    return { phase: "rate-limited", checkedAt, errorCode: "rate-limited" }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if ((error instanceof DOMException && error.name === "AbortError") || /timed? out|timeout/.test(message)) {
    return { phase: "unavailable", checkedAt, errorCode: "timeout" }
  }
  return { phase: "unavailable", checkedAt, errorCode: "unavailable" }
}

function numericCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined
  return typeof error.code === "number" ? error.code : undefined
}
