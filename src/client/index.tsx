import type { Context as ClientContext } from "@deepseek-ai/cordis"
import type {} from "@deepseek-ai/dsh-client-locale/client"
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client"
import type {} from "@deepseek-ai/dsh-client-ui-plugin-manager/client"
import type {} from "@deepseek-ai/dsh-client-ui-sidebar-right/client"
import type {} from "@deepseek-ai/dsh-api-remotes/client"
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots"
import { useCallback, useEffect, useState } from "react"
import {
  CONNECTIONS_NS,
  ConnectionsController,
  connectionsEn,
  connectionsZh,
  createConnectionsComponents,
  CONNECTIONS_TAB_ID,
  CONNECTIONS_TAB_KIND,
} from "./connections.js"
import { createOomolApi } from "./oomol-api.js"

const NS = "oomol.settings"

type LocaleKey =
  | "apiKey"
  | "replacementApiKey"
  | "runtimeApiKey"
  | "replacementRuntimeApiKey"
  | "configured"
  | "unconfigured"
  | "optional"
  | "storedCredential"
  | "replaceKey"
  | "cancelReplace"
  | "source"
  | "connectionStatus"
  | "connecting"
  | "connected"
  | "notChecked"
  | "unauthorized"
  | "rateLimited"
  | "unavailable"
  | "lastChecked"
  | "toolCount"
  | "writeOnlyHint"
  | "save"
  | "saving"
  | "remove"
  | "refresh"
  | "testConnection"
  | "testing"
  | "readOnly"
  | "saved"
  | "removed"
  | "failed"
  | "unsaved"
  | "links"
  | "connections"
  | "keys"
  | "logs"
  | "openConnectorConsole"

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "oomol.settings": LocaleKey
  }
}

type CardProps = PropsRuntime<"plugins.bundle.config"> & PropsLocale<typeof NS>

interface CredentialState {
  configured: boolean
  writable: boolean
  source?: string
}

interface ConnectorConfiguration {
  mode: "oomol-hosted" | "self-hosted"
  endpoint: string
  apiKeyEnv: string
  credentialRequired: boolean
  connectionsManagement: "embedded" | "external"
  consoleUrl: string
}

type ConnectionPhase = "unconfigured" | "connecting" | "connected" | "unauthorized" | "rate-limited" | "unavailable"

interface ConnectorStatus {
  phase: ConnectionPhase
  checkedAt?: string
  errorCode?: string
  serverName?: string
  serverVersion?: string
  toolCount?: number
}

const en: Record<LocaleKey, string> = {
  apiKey: "OOMOL MCP client key",
  replacementApiKey: "New OOMOL MCP client key",
  runtimeApiKey: "Runtime API key (optional)",
  replacementRuntimeApiKey: "New runtime API key",
  configured: "Configured",
  unconfigured: "Not configured",
  optional: "Optional",
  storedCredential: "Harness Credentials stores this key securely.",
  replaceKey: "Replace key",
  cancelReplace: "Cancel",
  source: "Source: {source}",
  connectionStatus: "Connection: {status}",
  connecting: "Connecting",
  connected: "Connected",
  notChecked: "Not checked yet",
  unauthorized: "Unauthorized",
  rateLimited: "Rate limited",
  unavailable: "Unavailable",
  lastChecked: "Last checked: {time}",
  toolCount: "Discovery tools: {count}",
  writeOnlyHint: "Harness Credentials stores the key as a write-only secret.",
  save: "Save key",
  saving: "Saving…",
  remove: "Remove key",
  refresh: "Refresh status",
  testConnection: "Test connection",
  testing: "Testing…",
  readOnly: "This key comes from a read-only source such as the launch environment. Change it at that source.",
  saved: "Key saved. The Connector client is reloading.",
  removed: "Key removed. OOMOL tools will be unloaded.",
  failed: "The operation failed. Check the Harness logs and credential source.",
  unsaved: "Unsaved",
  links: "OOMOL Console",
  connections: "Manage in Console",
  keys: "Manage API keys",
  logs: "View run logs",
  openConnectorConsole: "Open OpenConnector Console",
}

const zh: Record<LocaleKey, string> = {
  apiKey: "OOMOL MCP 客户端 Key",
  replacementApiKey: "新的 OOMOL MCP 客户端 Key",
  runtimeApiKey: "Runtime API Key（可选）",
  replacementRuntimeApiKey: "新的 Runtime API Key",
  configured: "已配置",
  unconfigured: "未配置",
  optional: "可选",
  storedCredential: "Key 已安全保存在 Harness Credentials 中。",
  replaceKey: "更换 Key",
  cancelReplace: "取消更换",
  source: "来源：{source}",
  connectionStatus: "连接状态：{status}",
  connecting: "连接中",
  connected: "已连接",
  notChecked: "尚未检测",
  unauthorized: "未授权或 Key 无效",
  rateLimited: "请求受限",
  unavailable: "暂时不可用",
  lastChecked: "上次检测：{time}",
  toolCount: "发现工具数：{count}",
  writeOnlyHint: "Harness Credentials 会以只写 Secret 保存 Key。",
  save: "保存 Key",
  saving: "保存中…",
  remove: "删除 Key",
  refresh: "刷新状态",
  testConnection: "测试连接",
  testing: "检测中…",
  readOnly: "当前 Key 来自启动环境等只读来源，请在对应来源中修改。",
  saved: "Key 已保存，Connector 客户端正在重新加载。",
  removed: "Key 已删除，OOMOL 工具将被卸载。",
  failed: "操作失败，请检查 Harness 日志和凭据来源。",
  unsaved: "未保存",
  links: "OOMOL 控制台",
  connections: "在 Console 管理连接",
  keys: "管理 API Key",
  logs: "查看运行日志",
  openConnectorConsole: "打开 OpenConnector Console",
}

export const inject = ["slots", "locale", "remote", "remote.credentials"]
const PACKAGE_NAME = "dsh-oomol"

export function apply(ctx: ClientContext): void {
  const api = createOomolApi()
  const credentials = ctx.remote.credentials
  const connections = new ConnectionsController()
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "oomol: settings dictionaries")
  ctx.effect(
    () => ctx.locale.register(CONNECTIONS_NS, { en: connectionsEn, zh: connectionsZh }),
    "oomol: connections dictionaries",
  )

  function OomolSettingsCard({ t }: CardProps) {
    const [credential, setCredential] = useState<CredentialState>({ configured: false, writable: true })
    const [configuration, setConfiguration] = useState<ConnectorConfiguration>()
    const [connector, setConnector] = useState<ConnectorStatus>({ phase: "unconfigured" })
    const [draft, setDraft] = useState("")
    const [editingKey, setEditingKey] = useState(false)
    const [busy, setBusy] = useState(false)
    const [testing, setTesting] = useState(false)
    const [message, setMessage] = useState<"saved" | "removed" | "failed" | undefined>()

    const refresh = useCallback(async () => {
      try {
        const configurationResponse = await api.call("configuration")
        if (!configurationResponse.ok || !isConnectorConfiguration(configurationResponse.value)) {
          throw new Error("Invalid Connector configuration")
        }
        const nextConfiguration = configurationResponse.value
        const [credentialResponse, connectorResponse] = await Promise.all([
          credentials.describe([nextConfiguration.apiKeyEnv]),
          api.call("status"),
        ])
        if (!credentialResponse.ok) throw new Error(credentialResponse.error.message)
        const view = credentialResponse.value[nextConfiguration.apiKeyEnv]
        setConfiguration(nextConfiguration)
        setCredential({
          configured: view?.configured ?? false,
          writable: view?.writable ?? true,
          ...(view?.source ? { source: view.source } : {}),
        })
        if (connectorResponse.ok && isConnectorStatus(connectorResponse.value)) {
          setConnector(connectorResponse.value)
        }
      } catch {
        setMessage("failed")
      }
    }, [])

    const testConnection = async (force = false) => {
      if (testing || (!force && (busy || (configuration?.credentialRequired && !credential.configured)))) return
      setTesting(true)
      setMessage(undefined)
      setConnector((current) => ({ ...current, phase: "connecting" }))
      try {
        const response = await api.call("test")
        if (!response.ok || !isConnectorStatus(response.value)) throw new Error("Invalid Connector status")
        setConnector(response.value)
      } catch {
        setConnector({ phase: "unavailable", errorCode: "unavailable" })
        setMessage("failed")
      } finally {
        setTesting(false)
      }
    }

    useEffect(() => {
      void refresh()
    }, [refresh])

    useEffect(() => {
      if (!configuration) return
      return ctx.remote.$on("credentials/reference-updated", (ref) => {
        if (String(ref) === configuration.apiKeyEnv) void refresh()
      })
    }, [configuration?.apiKeyEnv, refresh])

    const save = async () => {
      const value = draft.trim()
      if (!value || busy || !configuration) return
      setBusy(true)
      setMessage(undefined)
      try {
        const response = await credentials.set(configuration.apiKeyEnv, value)
        if (!response.ok) throw new Error(response.error.message)
        setDraft("")
        setEditingKey(false)
        setMessage("saved")
        await refresh()
        await testConnection(true)
        connections.invalidateAccountData()
      } catch {
        setMessage("failed")
      } finally {
        setBusy(false)
      }
    }

    const remove = async () => {
      if (busy || !configuration) return
      setBusy(true)
      setMessage(undefined)
      try {
        const response = await credentials.unset(configuration.apiKeyEnv)
        if (!response.ok) throw new Error(response.error.message)
        setDraft("")
        setEditingKey(false)
        setMessage("removed")
        await refresh()
        connections.invalidateAccountData()
      } catch {
        setMessage("failed")
      } finally {
        setBusy(false)
      }
    }

    const disabled = busy || !credential.writable
    const dirty = draft.trim().length > 0
    const showKeyEditor = !credential.configured || editingKey
    return (
          <div style={styles.cardBody}>
            <div style={styles.statusRow}>
              <span style={credential.configured ? styles.badgeSet : styles.badgeUnset}>
                {t(credential.configured ? "configured" : configuration?.credentialRequired === false ? "optional" : "unconfigured")}
              </span>
              {dirty ? <span style={styles.pending}>{t("unsaved")}</span> : null}
            </div>
            {credential.configured ? (
              <div style={styles.credentialSummary} role="status">
                <span style={styles.credentialCheck} aria-hidden="true">✓</span>
                <span>{t("storedCredential")}</span>
              </div>
            ) : null}
            {showKeyEditor ? (
              <>
                <label htmlFor="oomol-mcp-api-key" style={styles.label}>
                  {t(configuration?.mode === "self-hosted"
                    ? credential.configured ? "replacementRuntimeApiKey" : "runtimeApiKey"
                    : credential.configured ? "replacementApiKey" : "apiKey")}
                </label>
                <input
                  id="oomol-mcp-api-key"
                  type="password"
                  autoComplete="off"
                  value={draft}
                  disabled={disabled}
                  style={styles.input}
                  onChange={(event) => { setDraft(event.target.value) }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void save()
                  }}
                />
                <p style={styles.hint}>{t("writeOnlyHint")}</p>
              </>
            ) : null}
            {!credential.writable ? <p style={styles.warning}>{t("readOnly")}</p> : null}
            {credential.source ? <p style={styles.hint}>{t("source", { source: credential.source })}</p> : null}
            <p style={connector.phase === "connected" ? styles.success : connector.phase === "unauthorized" || connector.phase === "unavailable" ? styles.error : styles.hint}>
              {t("connectionStatus", { status: t(connector.phase === "unconfigured" && credential.configured ? "notChecked" : localeKeyForPhase(connector.phase)) })}
            </p>
            {connector.toolCount !== undefined ? <p style={styles.hint}>{t("toolCount", { count: connector.toolCount })}</p> : null}
            {connector.checkedAt ? <p style={styles.hint}>{t("lastChecked", {
              time: new Intl.DateTimeFormat(ctx.locale.getLocale().active === "zh" ? "zh-CN" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(connector.checkedAt)),
            })}</p> : null}
            {message ? <p role="status" style={message === "failed" ? styles.error : styles.success}>{t(message)}</p> : null}

            <div style={styles.actions}>
              {showKeyEditor ? (
                <button type="button" disabled={disabled || !dirty} style={{ ...styles.primary, ...((disabled || !dirty) ? styles.disabledButton : {}) }} onClick={() => { void save() }}>
                  {t(busy ? "saving" : "save")}
                </button>
              ) : (
                <button type="button" disabled={disabled} style={{ ...styles.secondary, ...(disabled ? styles.disabledButton : {}) }} onClick={() => {
                  setDraft("")
                  setMessage(undefined)
                  setEditingKey(true)
                }}>
                  {t("replaceKey")}
                </button>
              )}
              {credential.configured && editingKey ? (
                <button type="button" disabled={busy} style={{ ...styles.secondary, ...(busy ? styles.disabledButton : {}) }} onClick={() => {
                  setDraft("")
                  setEditingKey(false)
                }}>
                  {t("cancelReplace")}
                </button>
              ) : null}
              {credential.configured && !editingKey ? (
                <button type="button" disabled={disabled} style={{ ...styles.secondary, ...(disabled ? styles.disabledButton : {}) }} onClick={() => { void remove() }}>
                  {t("remove")}
                </button>
              ) : null}
              <button type="button" disabled={busy} style={{ ...styles.secondary, ...(busy ? styles.disabledButton : {}) }} onClick={() => { void refresh() }}>
                {t("refresh")}
              </button>
              <button type="button" disabled={busy || testing || (configuration?.credentialRequired === true && !credential.configured)} style={{ ...styles.secondary, ...((busy || testing || (configuration?.credentialRequired === true && !credential.configured)) ? styles.disabledButton : {}) }} onClick={() => { void testConnection() }}>
                {t(testing ? "testing" : "testConnection")}
              </button>
            </div>

            {configuration ? configuration.mode === "self-hosted" ? (
              <div style={styles.links}>
                <a href={configuration.consoleUrl} target="_blank" rel="noreferrer">{t("openConnectorConsole")}</a>
              </div>
            ) : (
              <div style={styles.links}>
                <span style={styles.linksLabel}>{t("links")}</span>
                <a href="https://console.oomol.com/connections" target="_blank" rel="noreferrer">{t("connections")}</a>
                <a href="https://console.oomol.com/api-key" target="_blank" rel="noreferrer">{t("keys")}</a>
                <a href="https://console.oomol.com" target="_blank" rel="noreferrer">{t("logs")}</a>
              </div>
            ) : null}
          </div>
    )
  }

  ctx.effect(
    () => ctx.remote.$on("credentials/reference-updated", () => { connections.invalidateAccountData() }),
    "oomol: credential invalidations",
  )
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: PACKAGE_NAME,
    locale: NS,
  }, OomolSettingsCard))

  ctx.inject(["sidebarRight", "sidebarRightTabs"], (ctx) => {
    const tConnections = ctx.locale.bind(CONNECTIONS_NS)
    ctx.effect(() => ctx.sidebarRightTabs.register({
      id: CONNECTIONS_TAB_ID,
      kind: CONNECTIONS_TAB_KIND,
      title: () => tConnections("title"),
      guide: [{ id: "connections", order: 60, title: () => tConnections("title"), description: () => tConnections("narrowViewportHint") }],
    }), "oomol: connections tab type")
    const { ConnectionsHeaderButton, ConnectionsDetails } = createConnectionsComponents(api, connections, () => {
      ctx.sidebarRight.openTab(CONNECTIONS_TAB_KIND)
    })
    ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
      name: "conversation.session.header.utilities",
      id: "oomol-connections",
      order: 40,
      locale: CONNECTIONS_NS,
    }, ConnectionsHeaderButton))
    ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: CONNECTIONS_TAB_ID,
      locale: CONNECTIONS_NS,
    }, ConnectionsDetails))
  })
}

function isConnectorStatus(value: unknown): value is ConnectorStatus {
  if (typeof value !== "object" || value === null || !("phase" in value)) return false
  return ["unconfigured", "connecting", "connected", "unauthorized", "rate-limited", "unavailable"].includes(String(value.phase))
}

function isConnectorConfiguration(value: unknown): value is ConnectorConfiguration {
  if (typeof value !== "object" || value === null) return false
  return "mode" in value
    && (value.mode === "oomol-hosted" || value.mode === "self-hosted")
    && "endpoint" in value && typeof value.endpoint === "string"
    && "apiKeyEnv" in value && typeof value.apiKeyEnv === "string"
    && "credentialRequired" in value && typeof value.credentialRequired === "boolean"
    && "connectionsManagement" in value
    && (value.connectionsManagement === "embedded" || value.connectionsManagement === "external")
    && "consoleUrl" in value && typeof value.consoleUrl === "string"
}

function localeKeyForPhase(phase: ConnectionPhase): LocaleKey {
  if (phase === "unconfigured") return "unconfigured"
  if (phase === "rate-limited") return "rateLimited"
  return phase
}

const styles = {
  pending: { whiteSpace: "nowrap", background: "var(--dsw-alias-bg-module-platform, #eceef1)", color: "var(--dsw-alias-label-secondary, #61666b)", borderRadius: 999, flexShrink: 0, padding: "1px 8px", fontSize: 11, fontWeight: 500, lineHeight: "17px" },
  badgeSet: { whiteSpace: "nowrap", flexShrink: 0, color: "var(--dsw-alias-state-success-primary, #12a150)", background: "var(--dsw-alias-state-success-tertiary, #e7f7ed)", borderRadius: 999, padding: "3px 9px", fontSize: 12 },
  badgeUnset: { whiteSpace: "nowrap", flexShrink: 0, color: "var(--dsw-alias-label-secondary, #61666b)", background: "var(--dsw-alias-bg-layer-2, #f5f6f7)", borderRadius: 999, padding: "3px 9px", fontSize: 12 },
  cardBody: { display: "grid", gap: 10 },
  statusRow: { display: "flex", alignItems: "center", gap: 8 },
  credentialSummary: { display: "flex", alignItems: "center", gap: 8, color: "var(--dsw-alias-state-success-primary, #12a150)", background: "var(--dsw-alias-state-success-tertiary, #e7f7ed)", borderRadius: 8, padding: "9px 11px", fontSize: 12, lineHeight: 1.5 },
  credentialCheck: { width: 18, height: 18, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 999, color: "var(--dsw-alias-state-success-tertiary, #e7f7ed)", background: "var(--dsw-alias-state-success-primary, #12a150)", fontSize: 12, fontWeight: 700, lineHeight: 1 },
  label: { fontWeight: 600, fontSize: 13, marginTop: 6 },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))", borderRadius: 8, padding: "9px 11px", background: "var(--dsw-alias-bg-layer-1, #fff)", color: "inherit" },
  hint: { opacity: 0.62, fontSize: 12, margin: 0 },
  warning: { color: "var(--dsw-alias-state-warn-primary, #e59a00)", fontSize: 12, margin: 0 },
  error: { color: "var(--dsw-alias-state-error-primary, #e5484d)", fontSize: 12, margin: 0 },
  success: { color: "var(--dsw-alias-state-success-primary, #12a150)", fontSize: 12, margin: 0 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 4 },
  primary: { border: 0, borderRadius: 8, padding: "8px 13px", background: "var(--dsw-alias-button-primary-fill, #3964fe)", color: "var(--dsw-alias-label-primary-foreground, #fff)", cursor: "pointer" },
  secondary: { border: "1px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))", borderRadius: 8, padding: "8px 13px", background: "transparent", color: "inherit", cursor: "pointer" },
  disabledButton: { opacity: 0.42, cursor: "default" },
  links: { display: "flex", gap: 12, flexWrap: "wrap" as const, borderTop: "1px solid var(--dsw-alias-border-l1, rgba(38,49,72,.08))", paddingTop: 12, marginTop: 4, fontSize: 12 },
  linksLabel: { opacity: 0.55 },
} as const
