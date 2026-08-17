import { describe, expect, it, vi } from "vitest"

import { createRepositoryRpcHandler } from "../src/repository.js"

describe("repository metadata RPC", () => {
  it("returns open-connector stars and caches GitHub for one hour", async () => {
    let now = 1_000
    const fetchRepository = vi.fn(async () => new Response(JSON.stringify({ message: "4.7k" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))
    const handle = createRepositoryRpcHandler({ fetch: fetchRepository as typeof fetch, now: () => now })

    const first = await handle("repository/open-connector", AbortSignal.timeout(1_000))
    now += 30 * 60_000
    const second = await handle("repository/open-connector", AbortSignal.timeout(1_000))

    expect(first).toEqual({
      ok: true,
      value: {
        owner: "oomol-lab",
        name: "open-connector",
        url: "https://github.com/oomol-lab/open-connector",
        stars: "4.7k",
      },
    })
    expect(second).toEqual(first)
    expect(fetchRepository).toHaveBeenCalledTimes(1)
  })

  it("keeps stale stars when GitHub is temporarily unavailable", async () => {
    let now = 1_000
    const fetchRepository = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "4.7k" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const handle = createRepositoryRpcHandler({ fetch: fetchRepository as typeof fetch, now: () => now })

    await handle("repository/open-connector", AbortSignal.timeout(1_000))
    now += 61 * 60_000
    const stale = await handle("repository/open-connector", AbortSignal.timeout(1_000))

    expect(stale).toMatchObject({ ok: true, value: { stars: "4.7k" } })
    expect(fetchRepository).toHaveBeenCalledTimes(2)
  })
})
