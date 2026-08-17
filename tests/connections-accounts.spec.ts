import { describe, expect, it } from "vitest"

import {
  deriveProviderConnectionState,
  hasAmbiguousDefault,
  pickDefaultOrSingleAccount,
  pickStatusAccount,
  type ConnectionAccountSummary,
} from "../src/client/connections-accounts.js"

describe("connection account selection", () => {
  it("selects a default account before another active account", () => {
    const active = app("active", "active")
    const selected = app("default", "reauth_required", true)

    expect(pickDefaultOrSingleAccount([active, selected])).toBe(selected)
    expect(pickStatusAccount([active, selected])).toBe(selected)
    expect(deriveProviderConnectionState([active, selected])).toBe("needs_attention")
  })

  it("keeps the Provider connected when only a non-default account needs attention", () => {
    const selected = app("default", "active", true)
    const backup = app("backup", "reauth_required")

    expect(pickStatusAccount([selected, backup])).toBe(selected)
    expect(deriveProviderConnectionState([selected, backup])).toBe("connected")
  })

  it("selects one account even when the backend did not mark it default", () => {
    const only = app("only", "active")

    expect(pickDefaultOrSingleAccount([only])).toBe(only)
    expect(hasAmbiguousDefault([only])).toBe(false)
    expect(deriveProviderConnectionState([only])).toBe("connected")
  })

  it("reports multiple accounts without a default as ambiguous", () => {
    const first = app("first", "active")
    const second = app("second", "active")

    expect(pickDefaultOrSingleAccount([first, second])).toBeNull()
    expect(pickStatusAccount([first, second])).toBe(first)
    expect(hasAmbiguousDefault([first, second])).toBe(true)
    expect(deriveProviderConnectionState([first, second])).toBe("ambiguous")
  })

  it("ignores disconnected accounts", () => {
    const disconnectedDefault = app("old", "disconnected", true)
    const current = app("current", "active")

    expect(pickDefaultOrSingleAccount([disconnectedDefault, current])).toBe(current)
    expect(deriveProviderConnectionState([disconnectedDefault])).toBe("not_connected")
  })
})

function app(id: string, status: string, isDefault = false): ConnectionAccountSummary {
  return { id, status, isDefault }
}
