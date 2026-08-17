import { afterEach, describe, expect, it, vi } from "vitest"

import { TimedMemoryCache } from "../src/client/connections-cache.js"

describe("TimedMemoryCache", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps the connection list fresh for one minute", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-17T00:00:00Z"))
    const cache = new TimedMemoryCache<string, { providers: unknown[]; apps: unknown[] }>(60_000)
    const list = { providers: [], apps: [] }

    cache.set("list", list)

    expect(cache.get("list")?.value).toBe(list)
    expect(cache.isFresh("list")).toBe(true)

    vi.advanceTimersByTime(60_000)
    expect(cache.isFresh("list")).toBe(false)
  })

  it("caches Provider details and clears all account-scoped data", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-17T00:00:00Z"))
    const cache = new TimedMemoryCache<string, { service: string }>(60_000)
    const provider = {
      service: "github",
    }

    cache.set("github", provider)

    expect(cache.get("github")?.value).toBe(provider)
    expect(cache.isFresh("github")).toBe(true)

    cache.clear()

    expect(cache.get("github")).toBeUndefined()
  })
})
