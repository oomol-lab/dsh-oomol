import { describe, expect, it } from "vitest"

import { isMarketplaceAccount, isVirtualAccount } from "../src/client/connections-accounts.js"
import {
  createInitialAuthorizationOptionIds,
  updateAuthorizationOptionIds,
  type AuthorizationOption,
} from "../src/client/connections-authorization-options.js"

const options: AuthorizationOption[] = [
  option("read:user", { required: true, defaultSelected: true }),
  option("repo", { defaultSelected: true, risk: "sensitive" }),
  option("user:email", { risk: "sensitive" }),
  option("workflow", { risk: "sensitive", requires: ["repo"] }),
  option("admin", { requires: ["workflow"] }),
  option("delete_repo", { risk: "destructive" }),
]

describe("authorization option selection", () => {
  it("starts new connections from required and default options in Provider order", () => {
    expect(createInitialAuthorizationOptionIds(options)).toEqual(["read:user", "repo"])
    expect(createInitialAuthorizationOptionIds(undefined)).toEqual([])
    expect(createInitialAuthorizationOptionIds([])).toEqual([])
  })

  it("starts reconnects from the current grant plus required options and dependencies", () => {
    expect(createInitialAuthorizationOptionIds(options, ["admin", "unknown-scope"])).toEqual([
      "read:user",
      "repo",
      "workflow",
      "admin",
    ])
  })

  it("falls back to defaults when the existing grant matches no declared option", () => {
    expect(createInitialAuthorizationOptionIds(options, [])).toEqual(["read:user", "repo"])
    expect(createInitialAuthorizationOptionIds(options, ["https://scope.example/read"])).toEqual(["read:user", "repo"])
  })

  it("selects required dependencies transitively", () => {
    expect(updateAuthorizationOptionIds(options, ["read:user"], "admin", true)).toEqual([
      "read:user",
      "repo",
      "workflow",
      "admin",
    ])
  })

  it("deselects only the chosen option, matching Connector requires semantics", () => {
    expect(updateAuthorizationOptionIds(options, ["read:user", "repo", "workflow"], "repo", false)).toEqual([
      "read:user",
      "workflow",
    ])
  })

  it("keeps required options selected and ignores unknown options", () => {
    const selected = ["read:user", "repo"]
    expect(updateAuthorizationOptionIds(options, selected, "read:user", false)).toBe(selected)
    expect(updateAuthorizationOptionIds(options, selected, "missing", true)).toBe(selected)
  })

  it("ignores dependencies on options the Provider did not declare", () => {
    const partial = [option("a", { requires: ["missing"] })]
    expect(updateAuthorizationOptionIds(partial, [], "a", true)).toEqual(["a"])
  })
})

describe("virtual accounts", () => {
  it("recognizes no-auth and Marketplace virtual app ids", () => {
    expect(isVirtualAccount({ id: "no_auth:weather" })).toBe(true)
    expect(isVirtualAccount({ id: "marketplace:oomol:search" })).toBe(true)
    expect(isVirtualAccount({ id: "app_123" })).toBe(false)
    expect(isMarketplaceAccount({ id: "marketplace:oomol:search" })).toBe(true)
    expect(isMarketplaceAccount({ id: "no_auth:weather" })).toBe(false)
  })
})

function option(id: string, overrides: Partial<AuthorizationOption> = {}): AuthorizationOption {
  return { id, label: id, required: false, defaultSelected: false, risk: "standard", ...overrides }
}
