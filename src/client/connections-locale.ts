/** Locales Connector localizes Provider metadata for; others fall back to English upstream. */
export type ConnectorLocale = "en" | "zh-CN"

/** Harness UI locale seen by the Connections panel, shaped for `useSyncExternalStore`. */
export interface ConnectionsLocaleSource {
  subscribe: (onChange: () => void) => () => void
  getActive: () => string
}

export function connectorLocaleOf(active: string): ConnectorLocale {
  return active === "zh" || active.startsWith("zh-") ? "zh-CN" : "en"
}
