export interface ConnectionAccountSummary {
  id: string
  status: string
  isDefault: boolean
  createdAt?: number
}

export type ProviderConnectionState = "not_connected" | "ambiguous" | "connected" | "needs_attention"

export function getManageableAccounts<T extends ConnectionAccountSummary>(apps: T[]): T[] {
  return apps.filter((app) => app.status !== "disconnected")
}

export function pickDefaultOrSingleAccount<T extends ConnectionAccountSummary>(apps: T[]): T | null {
  const candidates = getManageableAccounts(apps)
  return candidates.find((app) => app.isDefault) ?? (candidates.length === 1 ? candidates[0] ?? null : null)
}

export function pickStatusAccount<T extends ConnectionAccountSummary>(apps: T[]): T | null {
  const candidates = getManageableAccounts(apps)
  return (
    pickDefaultOrSingleAccount(candidates)
    ?? candidates.find((app) => app.status === "active")
    ?? [...candidates].sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0) || left.id.localeCompare(right.id))[0]
    ?? null
  )
}

export function hasAmbiguousDefault<T extends ConnectionAccountSummary>(apps: T[]): boolean {
  const candidates = getManageableAccounts(apps)
  return candidates.length > 1 && !candidates.some((app) => app.isDefault)
}

export function deriveProviderConnectionState<T extends ConnectionAccountSummary>(apps: T[]): ProviderConnectionState {
  const candidates = getManageableAccounts(apps)
  if (candidates.length === 0) return "not_connected"
  if (hasAmbiguousDefault(candidates)) return "ambiguous"
  return pickStatusAccount(candidates)?.status === "active" ? "connected" : "needs_attention"
}
