import type { ConnectionHandle } from "@deepseek-ai/dsh-client-connection/client"
import type {} from "@deepseek-ai/dsh-client-locale/client"
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client"
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client"
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots"
import { useCallback, useEffect, useState } from "react"
import {
  CONNECTIONS_NS,
  ConnectionsDrawerController,
  connectionsEn,
  connectionsZh,
  createConnectionsComponents,
} from "./connections.js"

const API_KEY_REF = "OOMOL_MCP_API_KEY"
const NS = "oomol.settings"

type LocaleKey =
  | "title"
  | "description"
  | "apiKey"
  | "configured"
  | "unconfigured"
  | "source"
  | "connectionStatus"
  | "connecting"
  | "connected"
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
  | "links"
  | "connections"
  | "keys"
  | "logs"

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "oomol.settings": LocaleKey
  }
}

type CardProps = PropsRuntime<"settings.plugin.item"> & PropsLocale<typeof NS>

interface CredentialState {
  configured: boolean
  writable: boolean
  source?: string
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
  title: "OOMOL Connector",
  description: "Connect DeepSeek Harness to OOMOL apps and Actions.",
  apiKey: "OOMOL MCP client key",
  configured: "Configured",
  unconfigured: "Not configured",
  source: "Source: {source}",
  connectionStatus: "Connection: {status}",
  connecting: "Connecting",
  connected: "Connected",
  unauthorized: "Unauthorized",
  rateLimited: "Rate limited",
  unavailable: "Unavailable",
  lastChecked: "Last checked: {time}",
  toolCount: "Discovery tools: {count}",
  writeOnlyHint: "The key is write-only. It is stored by Harness Credentials and is never returned to this page.",
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
  links: "OOMOL Console",
  connections: "Manage in Console",
  keys: "Manage API keys",
  logs: "View run logs",
}

const zh: Record<LocaleKey, string> = {
  title: "OOMOL Connector",
  description: "将 DeepSeek Harness 连接到 OOMOL 应用和 Actions。",
  apiKey: "OOMOL MCP 客户端 Key",
  configured: "已配置",
  unconfigured: "未配置",
  source: "来源：{source}",
  connectionStatus: "连接状态：{status}",
  connecting: "连接中",
  connected: "已连接",
  unauthorized: "未授权或 Key 无效",
  rateLimited: "请求受限",
  unavailable: "暂时不可用",
  lastChecked: "上次检测：{time}",
  toolCount: "发现工具数：{count}",
  writeOnlyHint: "Key 只能写入，由 Harness Credentials 保存，页面永远不会读取或回显明文。",
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
  links: "OOMOL 控制台",
  connections: "在 Console 管理连接",
  keys: "管理 API Key",
  logs: "查看运行日志",
}

export const inject = ["slots", "locale", "connection"]

export function apply(ctx: ClientContext): void {
  const connection = ctx.get("connection") as ConnectionHandle
  const { api } = connection
  const drawer = new ConnectionsDrawerController()
  const { ConnectionsHeaderButton, ConnectionsOverlay } = createConnectionsComponents(connection, drawer)
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "oomol: settings dictionaries")
  ctx.effect(
    () => ctx.locale.register(CONNECTIONS_NS, { en: connectionsEn, zh: connectionsZh }),
    "oomol: connections dictionaries",
  )

  function OomolSettingsCard({ t }: CardProps) {
    const [credential, setCredential] = useState<CredentialState>({ configured: false, writable: true })
    const [connector, setConnector] = useState<ConnectorStatus>({ phase: "unconfigured" })
    const [draft, setDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [testing, setTesting] = useState(false)
    const [message, setMessage] = useState<"saved" | "removed" | "failed" | undefined>()

    const refresh = useCallback(async () => {
      try {
        const [credentialResponse, connectorResponse] = await Promise.all([
          api.credentials.describe({ refs: [API_KEY_REF] }),
          (ctx.get("connection") as ConnectionHandle).rpc.call("/oomol", "status", {}),
        ])
        if (!credentialResponse.result.ok) throw new Error(credentialResponse.result.error.message)
        const view = credentialResponse.result.value.credentials[API_KEY_REF]
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
      if (testing || (!force && (busy || !credential.configured))) return
      setTesting(true)
      setMessage(undefined)
      setConnector((current) => ({ ...current, phase: "connecting" }))
      try {
        const response = await (ctx.get("connection") as ConnectionHandle).rpc.call("/oomol", "test", {})
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

    const save = async () => {
      const value = draft.trim()
      if (!value || busy) return
      setBusy(true)
      setMessage(undefined)
      try {
        const response = await api.credentials.set({ ref: API_KEY_REF, value })
        if (!response.result.ok) throw new Error(response.result.error.message)
        drawer.clearCache()
        setDraft("")
        setMessage("saved")
        await refresh()
        await testConnection(true)
      } catch {
        setMessage("failed")
      } finally {
        setBusy(false)
      }
    }

    const remove = async () => {
      if (busy) return
      setBusy(true)
      setMessage(undefined)
      try {
        const response = await api.credentials.unset({ ref: API_KEY_REF })
        if (!response.result.ok) throw new Error(response.result.error.message)
        drawer.clearCache()
        setDraft("")
        setMessage("removed")
        await refresh()
      } catch {
        setMessage("failed")
      } finally {
        setBusy(false)
      }
    }

    const disabled = busy || !credential.writable
    return (
      <li style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{t("title")}</div>
            <div style={styles.description}>{t("description")}</div>
          </div>
          <span style={credential.configured ? styles.badgeSet : styles.badgeUnset}>
            {t(credential.configured ? "configured" : "unconfigured")}
          </span>
        </div>

        <label htmlFor="oomol-mcp-api-key" style={styles.label}>{t("apiKey")}</label>
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
        {!credential.writable ? <p style={styles.warning}>{t("readOnly")}</p> : null}
        {credential.source ? <p style={styles.hint}>{t("source", { source: credential.source })}</p> : null}
        <p style={connector.phase === "connected" ? styles.success : connector.phase === "unauthorized" || connector.phase === "unavailable" ? styles.error : styles.hint}>
          {t("connectionStatus", { status: t(localeKeyForPhase(connector.phase)) })}
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
          <button type="button" disabled={disabled || draft.trim().length === 0} style={styles.primary} onClick={() => { void save() }}>
            {t(busy ? "saving" : "save")}
          </button>
          <button type="button" disabled={disabled || !credential.configured} style={styles.secondary} onClick={() => { void remove() }}>
            {t("remove")}
          </button>
          <button type="button" disabled={busy} style={styles.secondary} onClick={() => { void refresh() }}>
            {t("refresh")}
          </button>
          <button type="button" disabled={busy || testing || !credential.configured} style={styles.secondary} onClick={() => { void testConnection() }}>
            {t(testing ? "testing" : "testConnection")}
          </button>
        </div>

        <div style={styles.links}>
          <span style={styles.linksLabel}>{t("links")}</span>
          <a href="https://console.oomol.com/connections" target="_blank" rel="noreferrer">{t("connections")}</a>
          <a href="https://console.oomol.com/api-key" target="_blank" rel="noreferrer">{t("keys")}</a>
          <a href="https://console.oomol.com" target="_blank" rel="noreferrer">{t("logs")}</a>
        </div>
      </li>
    )
  }

  ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
    name: "settings.plugin.item",
    id: "oomol",
    order: 30,
    locale: NS,
  }, OomolSettingsCard))

  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "oomol-connections",
    order: 40,
    locale: CONNECTIONS_NS,
  }, ConnectionsHeaderButton))

  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "oomol-connections-drawer",
    order: 40,
    locale: CONNECTIONS_NS,
  }, ConnectionsOverlay))
}

function isConnectorStatus(value: unknown): value is ConnectorStatus {
  if (typeof value !== "object" || value === null || !("phase" in value)) return false
  return ["unconfigured", "connecting", "connected", "unauthorized", "rate-limited", "unavailable"].includes(String(value.phase))
}

function localeKeyForPhase(phase: ConnectionPhase): LocaleKey {
  if (phase === "unconfigured") return "unconfigured"
  if (phase === "rate-limited") return "rateLimited"
  return phase
}

const styles = {
  card: {
    listStyle: "none",
    border: "1px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))",
    borderRadius: 12,
    padding: 18,
    display: "grid",
    gap: 10,
  },
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
  title: { fontWeight: 650, fontSize: 16 },
  description: { opacity: 0.68, marginTop: 4, fontSize: 13 },
  badgeSet: { color: "var(--dsw-alias-state-success-primary, #12a150)", background: "var(--dsw-alias-state-success-tertiary, #e7f7ed)", borderRadius: 999, padding: "3px 9px", fontSize: 12 },
  badgeUnset: { color: "var(--dsw-alias-label-secondary, #61666b)", background: "var(--dsw-alias-bg-layer-2, #f5f6f7)", borderRadius: 999, padding: "3px 9px", fontSize: 12 },
  label: { fontWeight: 600, fontSize: 13, marginTop: 6 },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))", borderRadius: 8, padding: "9px 11px", background: "var(--dsw-alias-bg-layer-1, #fff)", color: "inherit" },
  hint: { opacity: 0.62, fontSize: 12, margin: 0 },
  warning: { color: "var(--dsw-alias-state-warn-primary, #e59a00)", fontSize: 12, margin: 0 },
  error: { color: "var(--dsw-alias-state-error-primary, #e5484d)", fontSize: 12, margin: 0 },
  success: { color: "var(--dsw-alias-state-success-primary, #12a150)", fontSize: 12, margin: 0 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 4 },
  primary: { border: 0, borderRadius: 8, padding: "8px 13px", background: "var(--dsw-alias-button-primary-fill, #3964fe)", color: "var(--dsw-alias-label-primary-foreground, #fff)", cursor: "pointer" },
  secondary: { border: "1px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))", borderRadius: 8, padding: "8px 13px", background: "transparent", color: "inherit", cursor: "pointer" },
  links: { display: "flex", gap: 12, flexWrap: "wrap" as const, borderTop: "1px solid var(--dsw-alias-border-l1, rgba(38,49,72,.08))", paddingTop: 12, marginTop: 4, fontSize: 12 },
  linksLabel: { opacity: 0.55 },
} as const
