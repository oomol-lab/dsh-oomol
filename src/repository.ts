const OPEN_CONNECTOR_STARS_API = "https://img.shields.io/github/stars/oomol-lab/open-connector.json"
const OPEN_CONNECTOR_URL = "https://github.com/oomol-lab/open-connector"
const REPOSITORY_CACHE_MS = 60 * 60_000

interface RepositoryCache {
  stars: string
  updatedAt: number
}

export interface RepositoryRpcContext {
  fetch?: typeof fetch
  now?: () => number
}

export function createRepositoryRpcHandler(context: RepositoryRpcContext = {}) {
  const fetchRepository = context.fetch ?? fetch
  const now = context.now ?? Date.now
  let cache: RepositoryCache | undefined

  return async (endpoint: string, signal: AbortSignal) => {
    if (endpoint !== "repository/open-connector") {
      return rpcError("not_found", "Unknown repository operation.")
    }

    if (cache && now() - cache.updatedAt < REPOSITORY_CACHE_MS) {
      return repositoryResult(cache.stars)
    }

    try {
      const response = await fetchRepository(OPEN_CONNECTOR_STARS_API, {
        headers: {
          accept: "application/json",
          "user-agent": "dsh-oomol",
        },
        signal,
      })
      if (!response.ok) {
        return cache ? repositoryResult(cache.stars) : rpcError("unavailable", "Repository metadata is unavailable.")
      }
      const payload = await response.json() as { message?: unknown }
      if (typeof payload.message !== "string" || !/^\d+(?:\.\d+)?[kKmM]?$/.test(payload.message)) {
        return cache ? repositoryResult(cache.stars) : rpcError("invalid_response", "Repository metadata is invalid.")
      }
      const stars = payload.message.toLowerCase()
      cache = { stars, updatedAt: now() }
      return repositoryResult(stars)
    } catch {
      return cache ? repositoryResult(cache.stars) : rpcError("unavailable", "Repository metadata is unavailable.")
    }
  }
}

function repositoryResult(stars: string) {
  return {
    ok: true as const,
    value: {
      owner: "oomol-lab",
      name: "open-connector",
      url: OPEN_CONNECTOR_URL,
      stars,
    },
  }
}

function rpcError(code: string, message: string) {
  return { ok: false as const, error: { code: "internal" as const, message, details: { repositoryCode: code } } }
}
