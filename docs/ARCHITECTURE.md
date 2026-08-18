# Architecture

## Runtime modes

`dsh-oomol` connects one DeepSeek Harness profile to one Connector endpoint. The normalized endpoint determines the runtime mode:

| Mode | Endpoint | Default API key reference |
| --- | --- | --- |
| `oomol-hosted` | `https://connector.oomol.com/v1/mcp` | `OOMOL_MCP_API_KEY` |
| `self-hosted` | Any other accepted endpoint | `OOMOL_CONNECT_RUNTIME_TOKEN` |

The mode is derived state returned to the Web client through loopback RPC. Cordis configuration contains no mode selector.

## Host runtime

The Host resolves the API key through Harness Credentials first and the launch environment second. OOMOL Hosted requires a key. Self-hosted OpenConnector can initialize without one when its deployment permits anonymous runtime access.

The official DeepSeek Harness MCP client owns Streamable HTTP initialization, tool discovery, registration, execution, and disposal. The plugin enables startup failure reporting on the child MCP client, converts the result into sanitized connection status, and applies the plugin-level `failOnStartupError` policy.

Credential updates dispose the active MCP client and create a fresh one. A manual connection test uses the same reload path, so the reported status reflects MCP initialization and discovery.

## Endpoint security

Remote endpoints use HTTPS. Plain HTTP is accepted for `localhost`, `127.0.0.1`, and `[::1]`. Endpoint URLs reject embedded credentials and fragments.

API keys are sent as Bearer credentials after endpoint validation. OOMOL Hosted can also receive the selected team name through `x-oo-team-name`.

## Client configuration

The loopback-only `/oomol` RPC exposes a safe configuration view:

```ts
interface ConnectorConfiguration {
  mode: "oomol-hosted" | "self-hosted"
  endpoint: string
  apiKeyEnv: string
  credentialRequired: boolean
  connectionsManagement: "embedded" | "external"
  consoleUrl: string
}
```

The credential value and request headers remain Host-side. The settings card uses `apiKeyEnv` with the Harness Credentials API and displays mode-specific labels.

## Connection management

OOMOL Hosted uses the native Harness details panel. A loopback BFF calls the fixed OOMOL Hosted Provider and app routes, sanitizes responses, and forwards Provider credentials only for the active connection request.

Self-hosted runtime keys authorize `/mcp` and `/v1`. OpenConnector's `/api` management routes use its administrative authentication boundary. The plugin opens the endpoint origin in a new browser tab so users can manage connections in OpenConnector Console.

## Progressive discovery

The Connector MCP server publishes a small discovery and execution surface. Harness searches Actions, loads the selected guide or schema, and executes the chosen Action. Provider catalogs remain outside the permanent Harness tool registry.

## Security boundaries

- Harness Credentials stores the Connector client key.
- OOMOL Connector or OpenConnector stores Provider credentials.
- Loopback RPC returns sanitized configuration, status, Provider, and app data.
- External Console links contain only a validated origin.
- MCP failures map to stable status codes before reaching browser state.
- Side-effecting calls with unknown outcomes require Provider-side verification before retry.
