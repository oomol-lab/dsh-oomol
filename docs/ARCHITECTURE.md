# Architecture

## Runtime path

```text
DeepSeek Harness
  -> dsh-oomol
  -> @deepseek-ai/dsh-mcp-client
  -> https://connector.oomol.com/v1/mcp
  -> OOMOL Connector action
  -> connected Provider account
```

The plugin is deliberately thin. It resolves an OOMOL MCP client credential, constructs the Streamable HTTP connection, and delegates protocol handling and tool registration to the official DeepSeek Harness MCP client.

The Host plugin remains active while the credential is absent. Its browser half writes the key through the loopback-fenced Harness Credentials API; `credentials/updated` then causes the Host half to dispose the old MCP client and mount a new one. The browser receives credential metadata only and never receives the value.

Connection testing uses a short-lived MCP initialization plus first-page `tools/list` probe. A loopback-only `/oomol` RPC channel returns the sanitized phase, server identity, and discovery-tool count. Raw remote errors and request headers never cross into the browser.

The same loopback-only channel provides a small Connections BFF for the native right-side drawer. The browser receives a sanitized Provider catalog and connection metadata. The Host resolves the permanent MCP key and calls fixed OOMOL Connector REST routes; the permanent key never enters browser state or a URL. OAuth uses the existing Console callback in a popup and the drawer detects completion by polling sanitized connection metadata, so this preview does not require Console changes.

## Responsibilities

### DeepSeek Harness

- Agent loop and model interaction
- Native tool registry
- Tool approval and result presentation
- Plugin lifecycle

### This plugin

- OOMOL endpoint configuration
- OOMOL MCP credential reference
- Personal or team identity header
- MCP client lifecycle composition
- Web settings card for write-only key configuration
- Credential-change-driven MCP client reload
- Credential-safe connection health and explicit test-connection flow
- Native Connections drawer and credential-fenced Connector REST bridge
- Future pairing and approval presentation

### OOMOL Connector

- Provider catalog and action schemas
- Provider OAuth, API keys, and custom credentials
- Token refresh and connection identity
- Action execution and logs
- Team and server-side policy

### OOCLI

- OOMOL login and diagnostics
- Headless verification of search, schema, apps, and execution
- Skill synchronization through `~/.agents/skills`
- Future `dsh` bootstrap and doctor integration

## Credential boundary

Provider secrets are never persisted by this plugin. API keys or custom credentials entered in the drawer make one loopback-fenced request to the Host, which forwards them to a fixed OOMOL Connector endpoint and discards them after the request. Provider tokens and stored credentials remain in OOMOL Connector and are never returned to the browser.

The plugin resolves one OOMOL MCP client key from the Harness credentials service or launching environment. The Host uses it for MCP Authorization and for the Connections BFF, but never returns it to browser code or places it in a URL. A missing key is an unconfigured state rather than a Host startup error, which keeps the settings surface available after first install.

The bundle patch contains only the credential reference name. This keeps the secret out of the profile manifest and the normal `--dump-config` output for the bundle layer.

## Tool discovery

OOMOL MCP uses progressive disclosure. DeepSeek Harness receives a small stable discovery surface instead of every Provider action schema at startup. The model searches for actions, reads the selected guide, then executes the exact action.

## Approval boundary

Before production release, verify that Harness approval UI clearly identifies the underlying Provider, Action, account, and important arguments for a generic MCP execution tool. If the official MCP bridge cannot provide an adequate approval view, add a thin action-aware approval controller without replacing the OOMOL MCP protocol.

Side-effecting MCP calls must not be automatically retried after an ambiguous transport failure. The HTTP Action API supports idempotency keys, but the current MCP `execute_action` contract does not.
