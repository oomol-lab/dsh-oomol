# dsh-oomol

OOMOL Connector for DeepSeek Harness. Connect apps and call Actions from one DSH plugin.

The implementation mounts DeepSeek Harness's official Streamable HTTP MCP client and connects it to OOMOL's progressive-disclosure Connector MCP endpoint. Workflow authoring and execution are outside the current release scope.

Provider OAuth tokens and API keys remain in OOMOL Connector. DeepSeek Harness receives only the dedicated OOMOL MCP client key.

## Status

This repository contains a Host + Web plugin tested through an isolated profile install and Web boot against DeepSeek Harness `0.1.0-rc.6`. DeepSeek Harness is in developer preview, so compatibility with later releases must be verified before publishing.

The initial version provides:

- a standard `dsh.bundle` package;
- runtime credential resolution through the Harness credentials service or launch environment;
- the hosted OOMOL MCP endpoint;
- optional OOMOL team selection;
- the official DSH MCP client's discovery, tool registration, timeout, and reconnect behavior;
- non-fatal startup while the key is unconfigured;
- live MCP client reload after a stored key is added, rotated, or removed;
- an OOMOL card under Settings > Plugins for write-only key configuration;
- tests that keep secrets out of the bundle configuration.

Copy-free browser pairing and action-aware policy remain planned; see [Architecture](./docs/ARCHITECTURE.md) and [Roadmap](./docs/ROADMAP.md).

## Prerequisites

- Node.js 22.19+ or 24+
- DeepSeek Harness
- An OOMOL MCP API key from the OOMOL Console

## Development

```bash
pnpm install
pnpm check
```

Run the environment doctor without printing any credential values:

```bash
pnpm run doctor
```

## Install from this checkout

Build the package, then add it to the Web profile:

```bash
pnpm build
dsh plugin --profile web add -w /absolute/path/to/dsh-oomol
```

After Harness starts, save the dedicated OOMOL MCP key under **Settings > Plugins > Plugin configuration > OOMOL Connector**. The browser receives only configured/source/writable metadata and never receives the stored value.

You can alternatively provide the key before starting Harness:

```bash
export OOMOL_MCP_API_KEY="api_..."
dsh web
```

To run as a team, also set:

```bash
export OOMOL_TEAM_NAME="your-team"
```

For personal identity, leave `OOMOL_TEAM_NAME` unset.

`oo` CLI is reserved for login, diagnostics, onboarding, and independent verification. Normal Action execution uses MCP directly and never reads OOCLI's internal authentication files.

## Configuration

The installed bundle inserts one `oomol` row. A later profile layer may replace its configuration:

```yaml
- id: oomol
  name: dsh-oomol
  config:
    endpoint: https://connector.oomol.com/v1/mcp
    apiKeyEnv: OOMOL_MCP_API_KEY
    teamNameEnv: OOMOL_TEAM_NAME
    serverName: oomol
    toolCallTimeoutMs: 60000
    failOnStartupError: false
```

The API key itself does not belong in `cordis.patch.yml`. The plugin resolves it at runtime so `dsh --dump-config` cannot reveal a secret from the bundle layer.

## Uninstall

```bash
dsh plugin --profile web remove dsh-oomol
```

Uninstalling the plugin does not remove or disconnect Provider accounts in OOMOL.

## Security

- Never commit an OOMOL API key or Provider credential.
- Use a dedicated, revocable MCP key for DeepSeek Harness.
- Provider credentials remain in OOMOL Connector.
- Review externally visible, destructive, or broad-sharing actions before execution.
- The production release must validate action-level approval UX before enabling broad write access.
- MCP `execute_action` does not carry the HTTP Action API's idempotency key; do not automatically retry side-effecting calls whose outcome is unknown.

## License

MIT
