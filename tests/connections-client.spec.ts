import { afterEach, describe, expect, it, vi } from "vitest"

import { TimedMemoryCache } from "../src/client/connections-cache.js"
import { ConnectionsListRequests } from "../src/client/connections-controller.js"

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

describe("ConnectionsListRequests", () => {
  it("does not publish account invalidation before the panel is activated", () => {
    const requests = new ConnectionsListRequests()
    const listener = vi.fn()
    const unsubscribe = requests.subscribe(listener)

    requests.invalidate()

    expect(listener).not.toHaveBeenCalled()
    expect(requests.getSnapshot()).toEqual({ activated: false, revision: 0 })
    unsubscribe()
  })

  it("publishes opens and active account invalidations as fresh snapshots", () => {
    const requests = new ConnectionsListRequests()
    const snapshots: Array<{ activated: boolean; revision: number }> = []
    const unsubscribe = requests.subscribe(() => {
      snapshots.push(requests.getSnapshot())
    })

    requests.request()
    requests.invalidate()

    expect(snapshots).toEqual([
      { activated: true, revision: 1 },
      { activated: true, revision: 2 },
    ])
    expect(snapshots[0]).not.toBe(snapshots[1])
    unsubscribe()
  })
})
