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
