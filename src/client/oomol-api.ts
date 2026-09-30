export type OomolApiResult =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } }

export interface OomolApi {
  call(endpoint: string, payload?: unknown, signal?: AbortSignal): Promise<OomolApiResult>
}

/**
 * Calls the Host's exact `/api/oomol/<endpoint>` routes. The path stays
 * document-relative so Harness deployments below a sub-path keep working, and
 * the browser-session cookie carries authentication.
 */
export function createOomolApi(
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  baseUrl: () => string = () => (globalThis as unknown as { document: { baseURI: string } }).document.baseURI,
): OomolApi {
  return {
    async call(endpoint, payload = {}, signal) {
      const response = await fetchImpl(new URL(`api/oomol/${endpoint}`, baseUrl()), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        ...(signal ? { signal } : {}),
      })
      const body = await response.json().catch(() => undefined) as unknown
      if (isResult(body)) return body
      throw new Error(`OOMOL request failed with HTTP ${response.status}`)
    },
  }
}

function isResult(value: unknown): value is OomolApiResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false
  if (value.ok === true) return "value" in value
  return value.ok === false && "error" in value && typeof value.error === "object" && value.error !== null
}
