import type { ConnectionHandle } from "@deepseek-ai/dsh-client-connection/client"
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client"
import type { ILayout } from "@deepseek-ai/dsh-client-ui-layout/client"
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react"
import { TimedMemoryCache } from "./connections-cache.js"

export const CONNECTIONS_NS = "oomol.connections"

type AuthType = "oauth2" | "api_key" | "custom_credential" | "federated" | "no_auth"

type ConnectionsLocaleKey =
  | "open"
  | "title"
  | "subtitle"
  | "close"
  | "refresh"
  | "search"
  | "loading"
  | "empty"
  | "connected"
  | "notConnected"
  | "needsAttention"
  | "back"
  | "connect"
  | "connecting"
  | "disconnect"
  | "disconnecting"
  | "addAnother"
  | "account"
  | "apiKey"
  | "customCredential"
  | "oauth"
  | "noAuth"
  | "federated"
  | "comment"
  | "required"
  | "permissions"
  | "oauthPopup"
  | "oauthWaiting"
  | "oauthBlocked"
  | "oauthFailed"
  | "connectedSuccess"
  | "disconnectedSuccess"
  | "configureFirst"
  | "tryAgain"
  | "openConsole"
  | "viewOnGitHub"
  | "poweredBy"
  | "githubStars"
  | "unsupported"
  | "confirmDisconnect"
  | "cancel"
  | "errorCancelled"
  | "errorUnavailable"
  | "errorUnauthorized"
  | "errorRateLimited"
  | "errorRequestFailed"
  | "errorInvalidResponse"
  | "errorInvalidRequest"
  | "errorNotFound"
  | "errorUnknown"

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "oomol.connections": ConnectionsLocaleKey
  }
}

export const connectionsEn: Record<ConnectionsLocaleKey, string> = {
  open: "Connections",
  title: "OOMOL Connections",
  subtitle: "{count} apps. Every connection your agents need.",
  close: "Close",
  refresh: "Refresh",
  search: "Search apps",
  loading: "Loading connections…",
  empty: "No apps match your search.",
  connected: "Connected",
  notConnected: "Not connected",
  needsAttention: "Needs attention",
  back: "All apps",
  connect: "Connect",
  connecting: "Connecting…",
  disconnect: "Disconnect",
  disconnecting: "Disconnecting…",
  addAnother: "Add another connection",
  account: "Connected accounts",
  apiKey: "API key",
  customCredential: "Credentials",
  oauth: "OAuth",
  noAuth: "No authorization",
  federated: "Federated identity",
  comment: "Connection note (optional)",
  required: "Required",
  permissions: "Permissions",
  oauthPopup: "Continue in the authorization window.",
  oauthWaiting: "Waiting for authorization to finish…",
  oauthBlocked: "The authorization window was blocked. Allow popups and try again.",
  oauthFailed: "Authorization was not detected. You can refresh to check again.",
  connectedSuccess: "Connection saved.",
  disconnectedSuccess: "Connection removed.",
  configureFirst: "Configure and test an OOMOL MCP key in Settings first.",
  tryAgain: "Try again",
  openConsole: "Open full Console",
  viewOnGitHub: "View open-connector on GitHub",
  poweredBy: "Powered by Open Connector",
  githubStars: "GitHub stars",
  unsupported: "This authentication method is not available here yet.",
  confirmDisconnect: "Confirm",
  cancel: "Cancel",
  errorCancelled: "The request was cancelled.",
  errorUnavailable: "OOMOL Connections is temporarily unavailable. Try again later.",
  errorUnauthorized: "The OOMOL MCP key is invalid or does not have access.",
  errorRateLimited: "Too many requests. Wait a moment and try again.",
  errorRequestFailed: "OOMOL could not complete the request.",
  errorInvalidResponse: "OOMOL returned an unexpected response.",
  errorInvalidRequest: "The connection request is invalid. Check the fields and try again.",
  errorNotFound: "The requested connection operation was not found.",
  errorUnknown: "The operation failed. Try again.",
}

export const connectionsZh: Record<ConnectionsLocaleKey, string> = {
  open: "连接",
  title: "OOMOL 连接中心",
  subtitle: "{count} 第三方应用，你想要的连接，应有尽有。",
  close: "关闭",
  refresh: "刷新",
  search: "搜索应用",
  loading: "正在加载连接…",
  empty: "没有匹配的应用。",
  connected: "已连接",
  notConnected: "未连接",
  needsAttention: "需要处理",
  back: "全部应用",
  connect: "连接",
  connecting: "连接中…",
  disconnect: "断开连接",
  disconnecting: "正在断开…",
  addAnother: "添加另一个连接",
  account: "已连接账号",
  apiKey: "API Key",
  customCredential: "凭据",
  oauth: "OAuth",
  noAuth: "无需授权",
  federated: "联合身份",
  comment: "连接备注（可选）",
  required: "必填",
  permissions: "权限",
  oauthPopup: "请在弹出的授权窗口中继续。",
  oauthWaiting: "正在等待授权完成…",
  oauthBlocked: "授权窗口被浏览器拦截，请允许弹窗后重试。",
  oauthFailed: "暂未检测到授权结果，可以刷新后再次确认。",
  connectedSuccess: "连接已保存。",
  disconnectedSuccess: "连接已断开。",
  configureFirst: "请先在设置中配置并测试 OOMOL MCP Key。",
  tryAgain: "重试",
  openConsole: "打开完整控制台",
  viewOnGitHub: "在 GitHub 上查看 open-connector",
  poweredBy: "Powered by Open Connector",
  githubStars: "GitHub Star 数",
  unsupported: "当前暂不支持这种认证方式。",
  confirmDisconnect: "确认断开",
  cancel: "取消",
  errorCancelled: "请求已取消。",
  errorUnavailable: "OOMOL 连接服务暂时不可用，请稍后重试。",
  errorUnauthorized: "OOMOL MCP Key 无效或没有访问权限。",
  errorRateLimited: "请求过于频繁，请稍后重试。",
  errorRequestFailed: "OOMOL 暂时无法完成这个请求。",
  errorInvalidResponse: "OOMOL 返回了无法识别的数据。",
  errorInvalidRequest: "连接请求无效，请检查填写内容后重试。",
  errorNotFound: "没有找到请求的连接操作。",
  errorUnknown: "操作失败，请重试。",
}

interface ProviderListItem {
  service: string
  displayName: string
  iconUrl: string | null
  categories: Array<{ id: string; displayName: string }>
  authTypes: AuthType[]
}

interface CredentialField {
  key: string
  label: string
  required: boolean
  secret: boolean
  placeholder?: string
  description?: string
}

interface ProviderDetail extends ProviderListItem {
  apiKeyConfig: {
    label?: string
    placeholder?: string
    description?: string
    extraFields: CredentialField[]
  } | null
  customCredentialConfig: { fields: CredentialField[] } | null
  oauthClientConfig: {
    configured: boolean
    clientConfigPolicy: "user_required" | "default_only"
    nextConnectSource: string
    authorizationScopeSelection?: {
      requiredInRequest: boolean
      options: Array<{
        value: string
        required: boolean
        defaultSelected: boolean
        risk: string
      }>
    }
  } | null
}

interface ConnectedApp {
  id: string
  service: string
  displayName: string
  accountLabel?: string
  alias?: string
  authType: AuthType | null
  status: string
  isDefault: boolean
  createdAt?: number
  updatedAt?: number
}

interface ConnectionsList {
  providers: ProviderListItem[]
  apps: ConnectedApp[]
}

interface ConnectResult {
  authorizationUrl?: string
  app?: ConnectedApp
}

interface RepositoryStatus {
  owner: string
  name: string
  url: string
  stars: string
}

const CONNECTIONS_CACHE_FRESH_MS = 60_000
const REPOSITORY_CACHE_FRESH_MS = 60 * 60_000
const OPEN_CONNECTOR_FALLBACK: RepositoryStatus = {
  owner: "oomol-lab",
  name: "open-connector",
  url: "https://github.com/oomol-lab/open-connector",
  stars: "4.7k",
}

export class ConnectionsController {
  #listCache = new TimedMemoryCache<"list", ConnectionsList>(CONNECTIONS_CACHE_FRESH_MS)
  #providerCache = new TimedMemoryCache<string, ProviderDetail>(CONNECTIONS_CACHE_FRESH_MS)
  #repositoryCache = new TimedMemoryCache<"open-connector", RepositoryStatus>(REPOSITORY_CACHE_FRESH_MS)

  getListCache = () => this.#listCache.get("list")

  setListCache = (value: ConnectionsList) => {
    this.#listCache.set("list", value)
  }

  isListCacheFresh = () => this.#listCache.isFresh("list")

  getProviderCache = (service: string) => this.#providerCache.get(service)

  setProviderCache = (service: string, value: ProviderDetail) => {
    this.#providerCache.set(service, value)
  }

  isProviderCacheFresh = (service: string) => this.#providerCache.isFresh(service)

  getRepositoryCache = () => this.#repositoryCache.get("open-connector")

  setRepositoryCache = (value: RepositoryStatus) => {
    this.#repositoryCache.set("open-connector", value)
  }

  isRepositoryCacheFresh = () => this.#repositoryCache.isFresh("open-connector")

  clearCache = () => {
    this.#listCache.clear()
    this.#providerCache.clear()
  }
}

type HeaderProps = PropsRuntime<"conversation.session.header.utilities"> & PropsLocale<typeof CONNECTIONS_NS>
type DetailsProps = PropsRuntime<"details"> & PropsLocale<typeof CONNECTIONS_NS>

export function createConnectionsComponents(
  connection: ConnectionHandle,
  controller: ConnectionsController,
  layout: ILayout,
) {
  function ConnectionsHeaderButton({ t }: HeaderProps) {
    return (
      <button
        type="button"
        aria-label={t("title")}
        style={styles.headerButton}
        onClick={() => { layout.openDetails() }}
      >
        <OomolMark size={17} />
        <span>{t("open")}</span>
      </button>
    )
  }

  function ConnectionsDetails({ t }: DetailsProps) {
    return (
      <ConnectionsPanel
        connection={connection}
        controller={controller}
        t={t}
        onClose={() => { layout.closeDetails() }}
      />
    )
  }

  return { ConnectionsHeaderButton, ConnectionsDetails }
}

function ConnectionsPanel({
  connection,
  controller,
  t,
  onClose,
}: {
  connection: ConnectionHandle
  controller: ConnectionsController
  t: (key: ConnectionsLocaleKey, params?: Record<string, unknown>) => string
  onClose: () => void
}) {
  const initialListCache = controller.getListCache()
  const initialRepositoryCache = controller.getRepositoryCache()
  const [data, setData] = useState<ConnectionsList | null>(() => initialListCache?.value ?? null)
  const [repository, setRepository] = useState<RepositoryStatus>(() => initialRepositoryCache?.value ?? OPEN_CONNECTOR_FALLBACK)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [provider, setProvider] = useState<ProviderDetail | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(() => initialListCache === undefined)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const hasListData = useRef(initialListCache !== undefined)

  useEffect(() => () => { alive.current = false }, [])

  const call = useCallback(async <T,>(endpoint: string, payload: unknown): Promise<T> => {
    const response = await connection.rpc.call("/oomol", endpoint, payload)
    if (!response.ok) throw new Error(t("errorUnknown"))
    const result = domainResultOf<T>(response.value)
    if (!result.ok) throw new Error(t(localeKeyForConnectionsReason(result.error.reason)))
    return result.value
  }, [connection, t])

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const next = await call<ConnectionsList>("connections/list", {})
      controller.setListCache(next)
      hasListData.current = true
      if (alive.current) setData(next)
      return next
    } catch (caught) {
      if (alive.current && (!quiet || !hasListData.current)) {
        setError(caught instanceof Error ? caught.message : String(caught))
      }
      throw caught
    } finally {
      if (alive.current && !quiet) setLoading(false)
    }
  }, [call, controller])

  useEffect(() => {
    const cached = controller.getListCache()
    if (cached && controller.isListCacheFresh()) return
    void refresh(cached !== undefined).catch(() => undefined)
  }, [controller, refresh])

  useEffect(() => {
    if (controller.isRepositoryCacheFresh()) return
    void call<RepositoryStatus>("repository/open-connector", {})
      .then((next) => {
        controller.setRepositoryCache(next)
        if (alive.current) setRepository(next)
      })
      .catch(() => undefined)
  }, [call, controller])

  useEffect(() => {
    if (!selectedService) {
      setProvider(null)
      return
    }
    const cached = controller.getProviderCache(selectedService)
    setProvider(cached?.value ?? null)
    if (cached && controller.isProviderCacheFresh(selectedService)) {
      setDetailLoading(false)
      return
    }
    let active = true
    setDetailLoading(cached === undefined)
    setError(null)
    void call<ProviderDetail>("connections/provider", { service: selectedService })
      .then((next) => {
        controller.setProviderCache(selectedService, next)
        if (active) setProvider(next)
      })
      .catch((caught) => {
        if (active && cached === undefined) setError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [call, controller, selectedService])

  const appsByService = useMemo(() => {
    const grouped = new Map<string, ConnectedApp[]>()
    for (const app of data?.apps ?? []) {
      if (app.status === "disconnected") continue
      const current = grouped.get(app.service) ?? []
      current.push(app)
      grouped.set(app.service, current)
    }
    return grouped
  }, [data])

  const visibleProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const providers = [...(data?.providers ?? [])]
    providers.sort((left, right) => {
      const connected = Number(appsByService.has(right.service)) - Number(appsByService.has(left.service))
      return connected || left.displayName.localeCompare(right.displayName)
    })
    if (!normalized) return providers
    return providers.filter((item) =>
      `${item.displayName} ${item.service} ${item.categories.map((category) => category.displayName).join(" ")}`
        .toLowerCase()
        .includes(normalized),
    )
  }, [appsByService, data, query])
  const providerCount = data ? data.providers.length.toLocaleString("en-US") : "1,300+"
  const subtitle = t("subtitle", { count: providerCount })

  return (
    <aside style={styles.panel} aria-label={t("title")}>
      <header style={styles.panelHeader}>
        <div style={styles.headingCopy}>
          <strong style={styles.panelTitle}>{t("title")}</strong>
          <span style={styles.panelSubtitle} title={subtitle}>{subtitle}</span>
        </div>
        <button type="button" style={styles.iconButton} aria-label={t("refresh")} title={t("refresh")} onClick={() => { void refresh().catch(() => undefined) }}>
          <RefreshIcon />
        </button>
        <button type="button" style={styles.iconButton} aria-label={t("close")} title={t("close")} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      {selectedService ? (
        <ProviderView
          apps={appsByService.get(selectedService) ?? []}
          call={call}
          loading={detailLoading}
          provider={provider}
          t={t}
          onBack={() => { setSelectedService(null); setError(null) }}
          onRefresh={refresh}
        />
      ) : (
        <div style={styles.panelBody}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}><SearchIcon /></span>
            <input
              type="search"
              value={query}
              placeholder={t("search")}
              aria-label={t("search")}
              style={styles.searchInput}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {loading ? <StatePanel>{t("loading")}</StatePanel> : null}
          {!loading && error ? <ErrorPanel error={error} t={t} retry={() => refresh()} /> : null}
          {!loading && !error && visibleProviders.length === 0 ? <StatePanel>{t("empty")}</StatePanel> : null}
          {!loading && !error ? (
            <div style={styles.providerList}>
              {visibleProviders.map((item) => {
                const apps = appsByService.get(item.service) ?? []
                const needsAttention = apps.some((app) => app.status !== "active")
                return (
                  <button key={item.service} type="button" style={styles.providerRow} onClick={() => {
                    setProvider(controller.getProviderCache(item.service)?.value ?? null)
                    setSelectedService(item.service)
                  }}>
                    <ProviderIcon provider={item} />
                    <span style={styles.providerCopy}>
                      <strong style={styles.providerName}>{item.displayName}</strong>
                      <span style={styles.providerMeta}>{authTypeLabels(item.authTypes, t)}</span>
                    </span>
                    <span style={needsAttention ? styles.statusWarning : apps.length ? styles.statusConnected : styles.statusIdle}>
                      {needsAttention ? t("needsAttention") : apps.length ? `${t("connected")} · ${apps.length}` : t("notConnected")}
                    </span>
                    <span style={styles.chevron}>›</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      )}

      <footer style={styles.panelFooter}>
        <span style={styles.footerProduct}>{t("poweredBy")}</span>
        <a
          href={repository.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("viewOnGitHub")}
          title={t("viewOnGitHub")}
          style={styles.githubLink}
        >
          <GitHubMark />
          <span style={styles.githubRepoName}>GitHub</span>
          <span
            style={styles.starTag}
            title={`${repository.stars} ${t("githubStars")}`}
            aria-label={`${repository.stars} ${t("githubStars")}`}
          >
            <span aria-hidden="true">★</span>
            <span>{repository.stars}</span>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </aside>
  )
}

function ProviderView({
  apps,
  call,
  loading,
  provider,
  t,
  onBack,
  onRefresh,
}: {
  apps: ConnectedApp[]
  call: <T>(endpoint: string, payload: unknown) => Promise<T>
  loading: boolean
  provider: ProviderDetail | null
  t: (key: ConnectionsLocaleKey, params?: Record<string, unknown>) => string
  onBack: () => void
  onRefresh: (quiet?: boolean) => Promise<ConnectionsList>
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const disconnect = async (app: ConnectedApp) => {
    setDisconnecting(app.id)
    setError(null)
    try {
      await call("connections/disconnect", { appId: app.id })
      setMessage(t("disconnectedSuccess"))
      await onRefresh(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setDisconnecting(null)
      setConfirming(null)
    }
  }

  return (
    <div style={styles.panelBody}>
      <button type="button" style={styles.backButton} onClick={onBack}>← {t("back")}</button>
      {loading || !provider ? <StatePanel>{t("loading")}</StatePanel> : (
        <>
          <div style={styles.providerHero}>
            <ProviderIcon provider={provider} large />
            <div style={styles.providerCopy}>
              <h2 style={styles.providerHeroTitle}>{provider.displayName}</h2>
              <span style={styles.providerMeta}>{provider.service}</span>
            </div>
          </div>

          {apps.length ? (
            <section style={styles.section}>
              <div style={styles.sectionTitle}>{t("account")}</div>
              <div style={styles.accountList}>
                {apps.map((app) => (
                  <div key={app.id} style={styles.accountRow}>
                    <span style={app.status === "active" ? styles.accountDot : styles.accountDotWarning} />
                    <span style={styles.providerCopy}>
                      <strong style={styles.accountName}>{app.alias || app.accountLabel || app.displayName}</strong>
                      <span style={styles.providerMeta}>{app.authType ? authTypeLabel(app.authType, t) : provider.displayName}</span>
                    </span>
                    {confirming === app.id ? (
                      <span style={styles.accountActions}>
                        <button type="button" style={styles.dangerButton} disabled={disconnecting === app.id} onClick={() => { void disconnect(app) }}>
                          {disconnecting === app.id ? t("disconnecting") : t("confirmDisconnect")}
                        </button>
                        <button type="button" style={styles.compactSecondaryButton} disabled={disconnecting === app.id} onClick={() => setConfirming(null)}>
                          {t("cancel")}
                        </button>
                      </span>
                    ) : (
                      <button type="button" style={styles.dangerButton} onClick={() => setConfirming(app.id)}>
                        {t("disconnect")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section style={styles.section}>
            <div style={styles.sectionTitle}>{apps.length ? t("addAnother") : t("connect")}</div>
            <ConnectionForm
              apps={apps}
              call={call}
              provider={provider}
              t={t}
              onConnected={async () => {
                setError(null)
                setMessage(t("connectedSuccess"))
                await onRefresh(true)
              }}
              onError={setError}
            />
          </section>
        </>
      )}
      {message ? <div role="status" style={styles.successMessage}>{message}</div> : null}
      {error ? <div role="alert" style={styles.errorMessage}>{error}</div> : null}
    </div>
  )
}

function ConnectionForm({
  apps,
  call,
  provider,
  t,
  onConnected,
  onError,
}: {
  apps: ConnectedApp[]
  call: <T>(endpoint: string, payload: unknown) => Promise<T>
  provider: ProviderDetail
  t: (key: ConnectionsLocaleKey, params?: Record<string, unknown>) => string
  onConnected: () => Promise<void>
  onError: (message: string | null) => void
}) {
  const [authType, setAuthType] = useState<AuthType>(provider.authTypes[0] ?? "oauth2")
  const [apiKey, setApiKey] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [oauthWaiting, setOauthWaiting] = useState(false)
  const scopeOptions = provider.oauthClientConfig?.authorizationScopeSelection?.options ?? []
  const [scopes, setScopes] = useState<string[]>(() => scopeOptions.filter((item) => item.required || item.defaultSelected).map((item) => item.value))
  const fields = authType === "api_key"
    ? provider.apiKeyConfig?.extraFields ?? []
    : authType === "custom_credential"
      ? provider.customCredentialConfig?.fields ?? []
      : []
  const missingRequired = fields.some((field) => field.required && !values[field.key]?.trim())
  const oauthUnavailable = authType === "oauth2" && provider.oauthClientConfig?.clientConfigPolicy === "user_required" && !provider.oauthClientConfig.configured
  const unsupported = authType === "federated"

  useEffect(() => {
    setApiKey("")
    setValues({})
    setComment("")
    setOauthWaiting(false)
    onError(null)
  }, [authType])

  const connect = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || unsupported || oauthUnavailable) return
    onError(null)
    let popup: Window | null = null
    if (authType === "oauth2") {
      popup = window.open("", `oomol-connect-${provider.service}`, "popup=yes,width=560,height=720,resizable=yes,scrollbars=yes")
      if (!popup) {
        onError(t("oauthBlocked"))
        return
      }
      popup.document.title = t("oauth")
      popup.document.body.textContent = t("oauthPopup")
    }
    setBusy(true)
    try {
      const baseline = appFingerprint(apps)
      const result = await call<ConnectResult>("connections/connect", {
        service: provider.service,
        authType,
        ...(authType === "api_key" ? { apiKey, extra: values } : {}),
        ...(authType === "custom_credential" ? { values } : {}),
        ...(authType === "oauth2" && scopeOptions.length ? { authorizationScopes: scopes } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      })
      if (result.authorizationUrl) {
        if (!popup || popup.closed) throw new Error(t("oauthBlocked"))
        popup.location.href = result.authorizationUrl
        setOauthWaiting(true)
        const detected = await pollForConnection(call, provider.service, baseline, popup)
        setOauthWaiting(false)
        if (!detected) throw new Error(t("oauthFailed"))
      } else {
        popup?.close()
      }
      setApiKey("")
      setValues({})
      setComment("")
      await onConnected()
    } catch (caught) {
      popup?.close()
      onError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
      setOauthWaiting(false)
    }
  }

  return (
    <form style={styles.form} onSubmit={(event) => { void connect(event) }}>
      {provider.authTypes.length > 1 ? (
        <div style={styles.authTabs}>
          {provider.authTypes.map((type) => (
            <button key={type} type="button" style={type === authType ? styles.authTabActive : styles.authTab} onClick={() => setAuthType(type)}>
              {authTypeLabel(type, t)}
            </button>
          ))}
        </div>
      ) : null}

      {authType === "api_key" ? (
        <Field label={provider.apiKeyConfig?.label || t("apiKey")} required description={provider.apiKeyConfig?.description}>
          <input type="password" value={apiKey} required autoComplete="off" style={styles.input} placeholder={provider.apiKeyConfig?.placeholder || t("apiKey")} onChange={(event) => setApiKey(event.target.value)} />
        </Field>
      ) : null}

      {fields.map((field) => (
        <Field key={field.key} label={field.label} required={field.required} description={field.description}>
          <input
            type={field.secret ? "password" : "text"}
            value={values[field.key] ?? ""}
            required={field.required}
            autoComplete="off"
            style={styles.input}
            placeholder={field.placeholder || field.label}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
          />
        </Field>
      ))}

      {authType === "oauth2" && scopeOptions.length ? (
        <fieldset style={styles.scopeFieldset}>
          <legend style={styles.fieldLabel}>{t("permissions")}</legend>
          {scopeOptions.map((option) => (
            <label key={option.value} style={styles.scopeOption}>
              <input
                type="checkbox"
                checked={option.required || scopes.includes(option.value)}
                disabled={option.required}
                onChange={(event) => setScopes((current) => event.target.checked ? [...new Set([...current, option.value])] : current.filter((scope) => scope !== option.value))}
              />
              <span>{option.value}{option.required ? ` · ${t("required")}` : ""}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {authType !== "no_auth" && authType !== "oauth2" && !unsupported ? (
        <Field label={t("comment")}>
          <input type="text" value={comment} style={styles.input} placeholder={t("comment")} onChange={(event) => setComment(event.target.value)} />
        </Field>
      ) : null}

      {oauthUnavailable ? <div style={styles.notice}>{t("oauthBlocked")} <a href="https://console.oomol.com/connections" target="_blank" rel="noreferrer">{t("openConsole")}</a></div> : null}
      {unsupported ? <div style={styles.notice}>{t("unsupported")} <a href="https://console.oomol.com/connections" target="_blank" rel="noreferrer">{t("openConsole")}</a></div> : null}
      {oauthWaiting ? <div style={styles.waiting}><span style={styles.spinner} />{t("oauthWaiting")}</div> : null}

      <button
        type="submit"
        style={styles.primaryButton}
        disabled={busy || unsupported || oauthUnavailable || missingRequired || (authType === "api_key" && !apiKey.trim())}
      >
        {busy ? t("connecting") : t("connect")}
      </button>
    </form>
  )
}

async function pollForConnection(
  call: <T>(endpoint: string, payload: unknown) => Promise<T>,
  service: string,
  baseline: string,
  popup: Window,
) {
  const deadline = Date.now() + 3 * 60_000
  while (Date.now() < deadline) {
    await delay(1_750)
    const list = await call<ConnectionsList>("connections/list", {})
    const nextApps = list.apps.filter((app) => app.service === service && app.status !== "disconnected")
    if (appFingerprint(nextApps) !== baseline && nextApps.some((app) => app.status === "active")) return true
    if (popup.closed && Date.now() + 8_000 < deadline) {
      const finalList = await call<ConnectionsList>("connections/list", {})
      return appFingerprint(finalList.apps.filter((app) => app.service === service && app.status !== "disconnected")) !== baseline
    }
  }
  return false
}

function appFingerprint(apps: ConnectedApp[]) {
  return apps
    .map((app) => `${app.id}:${app.status}:${app.updatedAt ?? ""}`)
    .sort()
    .join("|")
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

function Field({ children, description, label, required }: { children: ReactNode; description?: string | undefined; label: string; required?: boolean }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}{required ? <span style={styles.required}> *</span> : null}</span>
      {children}
      {description ? <span style={styles.fieldDescription}>{description}</span> : null}
    </label>
  )
}

function ProviderIcon({ provider, large = false }: { provider: ProviderListItem; large?: boolean }) {
  const size = large ? 52 : 40
  const [failed, setFailed] = useState(false)
  if (provider.iconUrl && !failed) {
    return (
      <img
        src={provider.iconUrl}
        alt=""
        width={size}
        height={size}
        loading={large ? "eager" : "lazy"}
        decoding="async"
        style={{ ...styles.providerIcon, width: size, height: size }}
        onError={() => setFailed(true)}
      />
    )
  }
  return <span style={{ ...styles.providerIcon, ...styles.providerIconFallback, width: size, height: size }}>{provider.displayName.slice(0, 1).toUpperCase()}</span>
}

function ErrorPanel({ error, retry, t }: { error: string; retry: () => Promise<unknown>; t: (key: ConnectionsLocaleKey) => string }) {
  return (
    <div role="alert" style={styles.statePanel}>
      <div style={styles.errorText}>{error}</div>
      <button type="button" style={styles.secondaryButton} onClick={() => { void retry().catch(() => undefined) }}>{t("tryAgain")}</button>
    </div>
  )
}

function StatePanel({ children }: { children: ReactNode }) {
  return <div style={styles.statePanel}>{children}</div>
}

function authTypeLabels(types: AuthType[], t: (key: ConnectionsLocaleKey) => string) {
  return types.map((type) => authTypeLabel(type, t)).join(" · ")
}

function authTypeLabel(type: AuthType, t: (key: ConnectionsLocaleKey) => string) {
  if (type === "oauth2") return t("oauth")
  if (type === "api_key") return t("apiKey")
  if (type === "custom_credential") return t("customCredential")
  if (type === "federated") return t("federated")
  return t("noAuth")
}

function localeKeyForConnectionsReason(reason: string): ConnectionsLocaleKey {
  if (reason === "unconfigured") return "configureFirst"
  if (reason === "cancelled") return "errorCancelled"
  if (reason === "unavailable") return "errorUnavailable"
  if (reason === "unauthorized") return "errorUnauthorized"
  if (reason === "rate_limited") return "errorRateLimited"
  if (reason === "request_failed") return "errorRequestFailed"
  if (reason === "invalid_response") return "errorInvalidResponse"
  if (reason === "invalid_request") return "errorInvalidRequest"
  if (reason === "unsupported") return "unsupported"
  if (reason === "not_found") return "errorNotFound"
  return "errorUnknown"
}

function domainResultOf<T>(value: unknown): { ok: true; value: T } | { ok: false; error: { reason: string } } {
  if (typeof value !== "object" || value === null || !("ok" in value) || typeof value.ok !== "boolean") {
    return { ok: false, error: { reason: "unknown" } }
  }
  if (value.ok === true && "value" in value) return { ok: true, value: value.value as T }
  if (value.ok === false && "error" in value && typeof value.error === "object" && value.error !== null
    && "reason" in value.error && typeof value.error.reason === "string") {
    return { ok: false, error: { reason: value.error.reason } }
  }
  return { ok: false, error: { reason: "unknown" } }
}

function OomolMark({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={{ display: "block", color: "var(--dsw-alias-label-primary, #0d1117)" }}
    >
      {/* Official standalone mark: https://oomol.com/en/brand-assets/ */}
      <path fill="currentColor" d="M71.5654 62.0342C73.4795 62.0342 75.032 63.582 75.0322 65.4912C75.0322 67.4006 73.4796 68.9492 71.5654 68.9492C69.6514 68.949 68.0996 67.4004 68.0996 65.4912C68.0998 63.5822 69.6516 62.0344 71.5654 62.0342Z" />
      <path fill="currentColor" d="M28.4346 31.3037C30.3485 31.3039 31.9002 32.8517 31.9004 34.7607C31.9004 36.6699 30.3486 38.2175 28.4346 38.2178C26.5204 38.2178 24.9678 36.6701 24.9678 34.7607C24.9679 32.8515 26.5205 31.3037 28.4346 31.3037Z" />
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M50 0C77.6142 4.12327e-06 100 22.3858 100 50C100 77.6142 77.6142 100 50 100C22.3858 100 4.1238e-06 77.6142 0 50C0 22.3858 22.3858 0 50 0ZM28.4346 25.9258C23.5429 25.9258 19.5773 29.8814 19.5771 34.7607C19.5771 39.6402 23.5428 43.5957 28.4346 43.5957C32.3862 43.5955 35.7335 41.0146 36.874 37.4502H40.7578C44.3733 37.4504 47.3047 40.374 47.3047 43.9805V56.2725C47.3047 62.849 52.649 68.1805 59.2422 68.1807H63.126C64.2664 71.7451 67.6138 74.327 71.5654 74.3271C76.4572 74.3271 80.4229 70.3707 80.4229 65.4912C80.4226 60.6119 76.4571 56.6562 71.5654 56.6562C67.6138 56.6564 64.2664 59.2382 63.126 62.8027H59.2422C55.6267 62.8026 52.6953 59.8789 52.6953 56.2725V43.9805C52.6953 37.4039 47.351 32.0724 40.7578 32.0723H36.874C35.7336 28.5078 32.3862 25.926 28.4346 25.9258Z" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ display: "block", flexShrink: 0 }}>
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.3-5.28-1.29-5.28-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.98 10.98 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M20 6v5h-5" />
      <path d="M19 11a7.5 7.5 0 1 0 .2 4" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: "block" }}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: "block" }}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

const border = "1px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))"
const muted = "var(--dsw-alias-label-secondary, #61666b)"
const surface = "var(--dsw-alias-bg-layer-1, #ffffff)"
const raised = "var(--dsw-alias-bg-layer-2, #f5f6f7)"
const primary = "var(--dsw-alias-label-primary, #0f1115)"
const tertiary = "var(--dsw-alias-label-tertiary, #81858c)"
const success = "var(--dsw-alias-state-success-primary, #12a150)"
const successSurface = "var(--dsw-alias-state-success-tertiary, #e7f7ed)"
const warning = "var(--dsw-alias-state-warn-primary, #e59a00)"
const warningSurface = "var(--dsw-alias-state-warn-tertiary, #fff5d6)"
const danger = "var(--dsw-alias-state-error-primary, #e5484d)"
const business = "var(--dsw-alias-state-business-primary, #3964fe)"
const businessSurface = "var(--dsw-alias-state-business-tertiary, #e8efff)"

const styles: Record<string, CSSProperties> = {
  headerButton: { border, minWidth: 104, height: 32, color: "var(--dsw-alias-label-primary, inherit)", cursor: "pointer", background: "transparent", borderRadius: 18, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, fontFamily: "inherit" },
  panel: { width: "100%", height: "100%", background: surface, color: primary, colorScheme: "inherit", display: "flex", flexDirection: "column", fontFamily: "var(--dsw-font-family, ui-sans-serif, system-ui)", overflow: "hidden" },
  panelHeader: { minHeight: 0, padding: "10px 16px", borderBottom: border, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  headingCopy: { minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 },
  panelTitle: { fontSize: 15, lineHeight: "20px" },
  panelSubtitle: { fontSize: 12, lineHeight: "16px", color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  iconButton: { width: 30, height: 30, flexShrink: 0, display: "grid", placeItems: "center", padding: 0, border, borderRadius: 8, color: "inherit", background: "transparent", cursor: "pointer", lineHeight: 0 },
  panelBody: { flex: 1, minHeight: 0, overflowY: "auto", padding: 16 },
  panelFooter: { minHeight: 42, flexShrink: 0, borderTop: border, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: surface, fontSize: 11 },
  footerProduct: { color: tertiary },
  githubLink: { minWidth: 0, minHeight: 28, display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 7, padding: "0 6px", color: muted, textDecoration: "none", fontWeight: 500 },
  githubRepoName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textUnderlineOffset: 3 },
  starTag: { flexShrink: 0, minHeight: 20, display: "inline-flex", alignItems: "center", gap: 3, border, borderRadius: 999, padding: "0 6px", background: raised, color: primary, fontSize: 10, lineHeight: "18px", textDecoration: "none" },
  searchWrap: { position: "relative", marginBottom: 14 },
  searchIcon: { position: "absolute", left: 12, top: "50%", width: 22, height: 22, transform: "translateY(-50%)", color: tertiary, pointerEvents: "none" },
  searchInput: { width: "100%", boxSizing: "border-box", height: 40, padding: "8px 12px 8px 44px", border, borderRadius: 10, background: raised, color: "inherit", outline: "none", font: "inherit" },
  providerList: { border, borderRadius: 12, overflow: "hidden", background: raised },
  providerRow: { width: "100%", minHeight: 66, padding: "11px 12px", border: 0, borderBottom: border, background: "transparent", color: "inherit", display: "flex", alignItems: "center", gap: 11, textAlign: "left", cursor: "pointer", font: "inherit" },
  providerIcon: { flex: "0 0 auto", objectFit: "contain", borderRadius: 10, border, background: "white", padding: 5, boxSizing: "border-box" },
  providerIconFallback: { display: "grid", placeItems: "center", padding: 0, background: businessSurface, color: business, fontWeight: 700 },
  providerCopy: { minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 },
  providerName: { fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  providerMeta: { color: muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  statusConnected: { color: success, background: successSurface, borderRadius: 999, padding: "4px 8px", fontSize: 10, whiteSpace: "nowrap" },
  statusWarning: { color: warning, background: warningSurface, borderRadius: 999, padding: "4px 8px", fontSize: 10, whiteSpace: "nowrap" },
  statusIdle: { color: muted, fontSize: 10, whiteSpace: "nowrap" },
  chevron: { fontSize: 22, color: muted },
  statePanel: { minHeight: 180, border, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, color: muted, textAlign: "center" },
  errorText: { color: danger, fontSize: 13 },
  backButton: { border: 0, background: "transparent", color: muted, padding: "4px 0", cursor: "pointer", font: "inherit", fontSize: 12, marginBottom: 14 },
  providerHero: { display: "flex", alignItems: "center", gap: 13, marginBottom: 18 },
  providerHeroTitle: { fontSize: 20, lineHeight: "26px", margin: 0 },
  section: { border, borderRadius: 12, background: raised, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 650, marginBottom: 12, color: muted, textTransform: "uppercase", letterSpacing: ".04em" },
  accountList: { display: "grid", gap: 8 },
  accountRow: { display: "flex", alignItems: "center", gap: 9, border, borderRadius: 9, padding: "9px 10px", background: surface },
  accountDot: { width: 8, height: 8, borderRadius: 999, background: success, boxShadow: `0 0 0 3px ${successSurface}` },
  accountDotWarning: { width: 8, height: 8, borderRadius: 999, background: warning, boxShadow: `0 0 0 3px ${warningSurface}` },
  accountName: { fontSize: 12 },
  accountActions: { flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 },
  dangerButton: { border, background: "var(--dsw-alias-interactive-bg-hover-danger, rgba(242,90,90,.08))", color: danger, borderRadius: 8, padding: "6px 9px", cursor: "pointer", font: "inherit", fontSize: 11 },
  compactSecondaryButton: { border, background: "transparent", color: muted, borderRadius: 8, padding: "6px 9px", cursor: "pointer", font: "inherit", fontSize: 11 },
  form: { display: "grid", gap: 12 },
  authTabs: { display: "flex", flexWrap: "wrap", gap: 6 },
  authTab: { border, borderRadius: 8, background: "transparent", color: muted, padding: "6px 9px", cursor: "pointer", font: "inherit", fontSize: 11 },
  authTabActive: { border: "1px solid var(--dsw-alias-button-ghost-active-border, rgba(57,100,254,.3))", borderRadius: 8, background: "var(--dsw-alias-button-ghost-active-fill, rgba(57,100,254,.1))", color: primary, padding: "6px 9px", cursor: "pointer", font: "inherit", fontSize: 11 },
  field: { display: "grid", gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 600 },
  required: { color: danger },
  fieldDescription: { color: muted, fontSize: 10, lineHeight: "15px" },
  input: { width: "100%", boxSizing: "border-box", border, borderRadius: 9, padding: "9px 10px", background: surface, color: "inherit", outline: "none", font: "inherit", fontSize: 12 },
  scopeFieldset: { border, borderRadius: 9, padding: 10, display: "grid", gap: 7, margin: 0 },
  scopeOption: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: muted, overflowWrap: "anywhere" },
  notice: { border, borderRadius: 9, padding: 10, background: warningSurface, color: warning, fontSize: 11, lineHeight: "16px" },
  waiting: { display: "flex", alignItems: "center", gap: 8, color: muted, fontSize: 11 },
  spinner: { width: 12, height: 12, border: "2px solid var(--dsw-alias-border-l2, rgba(38,49,72,.12))", borderTopColor: business, borderRadius: 999, animation: "spin 1s linear infinite" },
  primaryButton: { border: 0, borderRadius: 9, padding: "9px 13px", background: "var(--dsw-alias-button-primary-fill, #3964fe)", color: "var(--dsw-alias-label-primary-foreground, #fff)", cursor: "pointer", font: "inherit", fontWeight: 600, fontSize: 12 },
  secondaryButton: { border, borderRadius: 9, padding: "8px 12px", background: "transparent", color: "inherit", cursor: "pointer", font: "inherit", fontSize: 12 },
  successMessage: { border, background: successSurface, color: success, borderRadius: 9, padding: 10, marginTop: 12, fontSize: 11 },
  errorMessage: { border, background: "var(--dsw-alias-interactive-bg-hover-danger, rgba(242,90,90,.08))", color: danger, borderRadius: 9, padding: 10, marginTop: 12, fontSize: 11 },
}
