import { describe, expect, it } from "vitest"

import { statusFromConnectionReason } from "../src/health.js"

describe("statusFromConnectionReason", () => {
  const checkedAt = "2026-08-16T00:00:00.000Z"

  it("maps authorization failures without carrying remote text", () => {
    expect(statusFromConnectionReason("unauthorized", checkedAt)).toEqual({
      phase: "unauthorized",
      checkedAt,
      errorCode: "unauthorized",
    })
  })

  it("maps rate limiting", () => {
    expect(statusFromConnectionReason("rate_limited", checkedAt)).toEqual({
      phase: "rate-limited",
      checkedAt,
      errorCode: "rate-limited",
    })
  })

  it("maps cancellation and unknown failures safely", () => {
    expect(statusFromConnectionReason("cancelled", checkedAt)).toEqual({
      phase: "unavailable",
      checkedAt,
      errorCode: "timeout",
    })
    expect(statusFromConnectionReason("api_key_should_not_escape", checkedAt)).toEqual({
      phase: "unavailable",
      checkedAt,
      errorCode: "unavailable",
    })
  })
})
