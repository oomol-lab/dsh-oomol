import { describe, expect, it } from "vitest"

import { connectorLocaleOf } from "../src/client/connections-locale.js"
import { filterProvidersByQuery } from "../src/client/connections-search.js"

const amap = {
  service: "amap",
  displayName: "AMap",
  categories: [{ id: "maps", displayName: "Maps" }],
  searchAliases: ["gaode", "高德", "高德地图"],
}
const gmail = {
  service: "gmail",
  displayName: "Gmail",
  categories: [{ id: "communication", displayName: "沟通" }],
  searchAliases: ["google mail", "谷歌邮箱"],
}
const providers = [amap, gmail]

describe("filterProvidersByQuery", () => {
  it("returns every Provider for a blank query", () => {
    expect(filterProvidersByQuery(providers, "  ")).toBe(providers)
  })

  it("matches Chinese queries through Connector search aliases", () => {
    expect(filterProvidersByQuery(providers, "高德")).toEqual([amap])
    expect(filterProvidersByQuery(providers, " 邮箱 ")).toEqual([gmail])
  })

  it("keeps matching display names, services, categories, and aliases case-insensitively", () => {
    expect(filterProvidersByQuery(providers, "AMAP")).toEqual([amap])
    expect(filterProvidersByQuery(providers, "communication")).toEqual([gmail])
    expect(filterProvidersByQuery(providers, "沟通")).toEqual([gmail])
    expect(filterProvidersByQuery(providers, "Google Mail")).toEqual([gmail])
    expect(filterProvidersByQuery(providers, "没有")).toEqual([])
  })
})

describe("connectorLocaleOf", () => {
  it("maps Harness Chinese locales to zh-CN and everything else to English", () => {
    expect(connectorLocaleOf("zh")).toBe("zh-CN")
    expect(connectorLocaleOf("zh-TW")).toBe("zh-CN")
    expect(connectorLocaleOf("en")).toBe("en")
    expect(connectorLocaleOf("ja")).toBe("en")
  })
})
