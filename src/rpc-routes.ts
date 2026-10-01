import type { ConnectionFetchRoute } from "@deepseek-ai/dsh-client-connection"

/**
 * Harness serves plugin Fetch routes below `/api` behind its Host/Origin fence
 * and browser-session cookie. Every OOMOL operation is one exact POST route.
 */
export const OOMOL_API_PREFIX = "/api/oomol"

export const OOMOL_ENDPOINTS = [
  "configuration",
  "status",
  "test",
  "repository/open-connector",
  "connections/list",
  "connections/provider",
  "connections/connect",
  "connections/disconnect",
  "connections/set-default",
] as const

export type OomolEndpoint = (typeof OOMOL_ENDPOINTS)[number]

export type OomolRpcResult =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } }

export type OomolRpcHandler = (endpoint: OomolEndpoint, payload: unknown, signal: AbortSignal) => Promise<OomolRpcResult>

export function createOomolFetchRoutes(
  handler: OomolRpcHandler,
  onError: (endpoint: OomolEndpoint, error: unknown) => void = () => undefined,
): ConnectionFetchRoute[] {
  return OOMOL_ENDPOINTS.map((endpoint) => ({
    path: `${OOMOL_API_PREFIX}/${endpoint}`,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      let payload: unknown
      try {
        const text = await request.text()
        payload = text ? JSON.parse(text) as unknown : {}
      } catch {
        return json(400, failure("invalid_request", "Request body must be JSON."))
      }
      try {
        return json(200, await handler(endpoint, payload, request.signal))
      } catch (error) {
        // Host errors can carry endpoint or credential details; keep them in Host logs.
        onError(endpoint, error)
        return json(500, failure("internal", "OOMOL request failed."))
      }
    },
  }))
}

function failure(code: string, message: string): OomolRpcResult {
  return { ok: false, error: { code, message, details: {} } }
}

function json(status: number, body: OomolRpcResult): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
}
