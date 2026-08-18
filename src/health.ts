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

export function statusFromConnectionReason(
  reason: string,
  checkedAt = new Date().toISOString(),
): OomolConnectionStatus {
  if (reason === "unauthorized") return { phase: "unauthorized", checkedAt, errorCode: "unauthorized" }
  if (reason === "rate_limited") return { phase: "rate-limited", checkedAt, errorCode: "rate-limited" }
  if (reason === "cancelled") return { phase: "unavailable", checkedAt, errorCode: "timeout" }
  return { phase: "unavailable", checkedAt, errorCode: "unavailable" }
}

export function statusFromMcpError(
  error: unknown,
  checkedAt = new Date().toISOString(),
): OomolConnectionStatus {
  const status = httpStatusFromError(error)
  if (status === 401 || status === 403) return { phase: "unauthorized", checkedAt, errorCode: "unauthorized" }
  if (status === 429) return { phase: "rate-limited", checkedAt, errorCode: "rate-limited" }
  return { phase: "unavailable", checkedAt, errorCode: "unavailable" }
}

function httpStatusFromError(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  if ("status" in error && typeof error.status === "number") return error.status
  if ("code" in error && typeof error.code === "number" && 100 <= error.code && error.code < 600) return error.code
  if ("response" in error && typeof error.response === "object" && error.response !== null && "status" in error.response) {
    return typeof error.response.status === "number" ? error.response.status : undefined
  }
  return "cause" in error ? httpStatusFromError(error.cause) : undefined
}
