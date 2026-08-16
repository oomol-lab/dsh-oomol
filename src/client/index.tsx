import type { ConnectionHandle } from "@deepseek-ai/dsh-client-connection/client"
import type {} from "@deepseek-ai/dsh-client-locale/client"
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client"
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client"
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots"
import { useCallback, useEffect, useState } from "react"

const API_KEY_REF = "OOMOL_MCP_API_KEY"
const NS = "oomol.settings"

type LocaleKey =
  | "title"
  | "description"
  | "apiKey"
  | "configured"
  | "unconfigured"
  | "source"
  | "writeOnlyHint"
  | "save"
  | "saving"
  | "remove"
  | "refresh"
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

const en: Record<LocaleKey, string> = {
  title: "OOMOL Connector",
  description: "Connect DeepSeek Harness to OOMOL apps and Actions.",
  apiKey: "OOMOL MCP client key",
  configured: "Configured",
  unconfigured: "Not configured",
  source: "Source: {source}",
  writeOnlyHint: "The key is write-only. It is stored by Harness Credentials and is never returned to this page.",
  save: "Save key",
  saving: "Saving…",
  remove: "Remove key",
  refresh: "Refresh status",
  readOnly: "This key comes from a read-only source such as the launch environment. Change it at that source.",
  saved: "Key saved. The Connector client is reloading.",
  removed: "Key removed. OOMOL tools will be unloaded.",
  failed: "The operation failed. Check the Harness logs and credential source.",
  links: "OOMOL Console",
  connections: "Manage connections",
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
  writeOnlyHint: "Key 只能写入，由 Harness Credentials 保存，页面永远不会读取或回显明文。",
  save: "保存 Key",
  saving: "保存中…",
  remove: "删除 Key",
  refresh: "刷新状态",
  readOnly: "当前 Key 来自启动环境等只读来源，请在对应来源中修改。",
  saved: "Key 已保存，Connector 客户端正在重新加载。",
  removed: "Key 已删除，OOMOL 工具将被卸载。",
  failed: "操作失败，请检查 Harness 日志和凭据来源。",
  links: "OOMOL 控制台",
  connections: "管理连接",
  keys: "管理 API Key",
  logs: "查看运行日志",
}

export const inject = ["slots", "locale", "connection"]

export function apply(ctx: ClientContext): void {
  const { api } = ctx.get("connection") as ConnectionHandle
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "oomol: settings dictionaries")

  function OomolSettingsCard({ t }: CardProps) {
    const [credential, setCredential] = useState<CredentialState>({ configured: false, writable: true })
    const [draft, setDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<"saved" | "removed" | "failed" | undefined>()

    const refresh = useCallback(async () => {
      try {
        const response = await api.credentials.describe({ refs: [API_KEY_REF] })
        if (!response.result.ok) return
        const view = response.result.value.credentials[API_KEY_REF]
        setCredential({
          configured: view?.configured ?? false,
          writable: view?.writable ?? true,
          ...(view?.source ? { source: view.source } : {}),
        })
      } catch {
        setMessage("failed")
      }
    }, [])

    useEffect(() => {
      void refresh()
    }, [refresh])

    const save = async () => {
      const value = draft.trim()
      if (!value || busy) return
      setBusy(true)
      setMessage(undefined)
      try {
        await api.credentials.set({ ref: API_KEY_REF, value })
        setDraft("")
        setMessage("saved")
        await refresh()
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
        await api.credentials.unset({ ref: API_KEY_REF })
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
}

const styles = {
  card: {
    listStyle: "none",
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 12,
    padding: 18,
    display: "grid",
    gap: 10,
  },
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
  title: { fontWeight: 650, fontSize: 16 },
  description: { opacity: 0.68, marginTop: 4, fontSize: 13 },
  badgeSet: { color: "#147d4f", background: "#e7f7ef", borderRadius: 999, padding: "3px 9px", fontSize: 12 },
  badgeUnset: { opacity: 0.65, background: "color-mix(in srgb, currentColor 8%, transparent)", borderRadius: 999, padding: "3px 9px", fontSize: 12 },
  label: { fontWeight: 600, fontSize: 13, marginTop: 6 },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid color-mix(in srgb, currentColor 18%, transparent)", borderRadius: 8, padding: "9px 11px", background: "transparent", color: "inherit" },
  hint: { opacity: 0.62, fontSize: 12, margin: 0 },
  warning: { color: "#a05a00", fontSize: 12, margin: 0 },
  error: { color: "#b42318", fontSize: 12, margin: 0 },
  success: { color: "#147d4f", fontSize: 12, margin: 0 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 4 },
  primary: { border: 0, borderRadius: 8, padding: "8px 13px", background: "#4f46e5", color: "white", cursor: "pointer" },
  secondary: { border: "1px solid color-mix(in srgb, currentColor 18%, transparent)", borderRadius: 8, padding: "8px 13px", background: "transparent", color: "inherit", cursor: "pointer" },
  links: { display: "flex", gap: 12, flexWrap: "wrap" as const, borderTop: "1px solid color-mix(in srgb, currentColor 10%, transparent)", paddingTop: 12, marginTop: 4, fontSize: 12 },
  linksLabel: { opacity: 0.55 },
} as const
