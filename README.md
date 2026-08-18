# OOMOL Connector for DeepSeek Harness

Use OOMOL Connector Actions from DeepSeek Harness through progressive MCP discovery.

`dsh-oomol` supports OOMOL Hosted and self-hosted OpenConnector. One plugin instance connects to one Connector endpoint.

[npm package](https://www.npmjs.com/package/dsh-oomol) | [中文文档](./docs/README.zh-CN.md)

## Requirements

- Node.js 22.19 or later within Node.js 22, or Node.js 24+
- DeepSeek Harness
- An OOMOL account for OOMOL Hosted, or a running OpenConnector instance for self-hosted use

## Install

Install the plugin into the Web profile and restart Harness:

```bash
dsh plugin --profile web add -w dsh-oomol
dsh web
```

The plugin appears under **Settings > Plugins > OOMOL Connector**.

## OOMOL Hosted

The package connects to OOMOL Hosted by default:

```yaml
- id: oomol
  name: dsh-oomol
  config:
    endpoint: https://connector.oomol.com/v1/mcp
    teamNameEnv: OOMOL_TEAM_NAME
    serverName: oomol
    toolCallTimeoutMs: 60000
    failOnStartupError: false
```

Create an OOMOL MCP API key in [OOMOL Console](https://console.oomol.com/api-key), then save it in the plugin settings. Harness Credentials stores the key under `OOMOL_MCP_API_KEY`.

Managed environments can provide it at launch:

```bash
export OOMOL_MCP_API_KEY="api_..."
dsh web
```

Set a team identity when needed:

```bash
export OOMOL_TEAM_NAME="your-team"
dsh web
```

The Connections button opens the native Harness panel for OOMOL Hosted accounts.

## Self-hosted OpenConnector

Override the endpoint in the profile's `cordis.patch.yml`:

```yaml
- update:
    id: oomol
    config:
      endpoint: http://127.0.0.1:3000/mcp
```

The plugin recognizes every non-official endpoint as self-hosted. Local OpenConnector deployments can run without authentication. Deployments with runtime authentication use the key stored under `OOMOL_CONNECT_RUNTIME_TOKEN`:

```bash
export OOMOL_CONNECT_RUNTIME_TOKEN="oct_..."
dsh web
```

You can also save the runtime API key in the plugin settings. Create persistent runtime keys in the OpenConnector Console Access page.

Self-hosted HTTP endpoints are limited to `localhost`, `127.0.0.1`, and `[::1]`. Remote deployments use HTTPS:

```yaml
- update:
    id: oomol
    config:
      endpoint: https://connect.example.com/mcp
```

The Connections button opens the endpoint origin, such as `https://connect.example.com`, where OpenConnector serves its Console.

## Custom API key environment name

Both modes support an explicit credential reference:

```yaml
- update:
    id: oomol
    config:
      endpoint: https://connect.example.com/mcp
      apiKeyEnv: MY_CONNECT_RUNTIME_TOKEN
```

Harness Credentials resolves `apiKeyEnv` first and the launch environment second.

## Use Connector Actions

Start with discovery:

```text
Show me the connectors available to this account.
```

```text
Find Actions that can create a calendar event and inspect the selected Action schema.
```

For operations with external effects, include the target account and proposed arguments in your request before execution.

## How it works

The plugin mounts DeepSeek Harness's Streamable HTTP MCP client with the selected Connector endpoint. Connector Actions remain progressively discoverable, keeping the permanent Harness tool surface small.

OOMOL Hosted stores Provider credentials in OOMOL Connector. Self-hosted deployments store them in OpenConnector. Harness stores only the Connector client key selected by `apiKeyEnv`.

The browser receives the credential reference and status metadata. Connector API keys and Provider credentials stay in Host-side secret boundaries.

See [Architecture](./docs/ARCHITECTURE.md) for implementation details.

## Configuration

| Field | Default | Purpose |
| --- | --- | --- |
| `endpoint` | `https://connector.oomol.com/v1/mcp` | Streamable HTTP MCP endpoint |
| `apiKeyEnv` | Derived from `endpoint` | Harness credential reference and launch environment name |
| `teamName` | unset | OOMOL Hosted team identity |
| `teamNameEnv` | `OOMOL_TEAM_NAME` | OOMOL Hosted team environment name |
| `serverName` | `oomol` | Harness MCP tool namespace |
| `toolCallTimeoutMs` | `60000` | Tool call timeout |
| `failOnStartupError` | `false` | Fail Harness startup when MCP discovery fails |

Derived credential references:

| Endpoint mode | Default reference | Required |
| --- | --- | --- |
| OOMOL Hosted | `OOMOL_MCP_API_KEY` | Yes |
| Self-hosted | `OOMOL_CONNECT_RUNTIME_TOKEN` | Depends on the OpenConnector deployment |

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Plugin missing from Settings | Install it in the `web` profile and restart `dsh web` |
| OOMOL Hosted shows Not configured | Save an OOMOL MCP API key in plugin settings |
| Self-hosted returns Unauthorized | Save a runtime API key created by that OpenConnector instance |
| Self-hosted Console link returns 404 | Open the Console URL configured by the OpenConnector deployment |
| Expected app is missing | Open the relevant Connector Console and configure the Provider connection |
| Connections panel stays closed | Widen the window to at least 1220 px so Harness can show its details column |

Run local diagnostics:

```bash
pnpm run doctor
```

## Security

- Store Connector API keys in Harness Credentials or the launch environment.
- Use HTTPS for remote self-hosted endpoints.
- Review destructive, externally visible, permission-changing, and broad-sharing Actions before execution.
- Treat an ambiguous side-effecting call as an unknown outcome and inspect the Provider before retrying.
- Report vulnerabilities through [SECURITY.md](./SECURITY.md).

## Development

```bash
pnpm install --frozen-lockfile
pnpm check
```

Build and install the checkout into a Web profile:

```bash
pnpm build
dsh plugin --profile web add -w "$(pwd)"
```

License: MIT
