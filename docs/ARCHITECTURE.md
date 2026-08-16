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
- Future pairing, richer connection status, and approval presentation

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

Provider secrets never enter this plugin. The plugin resolves one OOMOL MCP client key from the Harness credentials service or launching environment and passes it only in the MCP Authorization header. A missing key is an unconfigured state rather than a Host startup error, which keeps the settings surface available after first install.

The bundle patch contains only the credential reference name. This keeps the secret out of the profile manifest and the normal `--dump-config` output for the bundle layer.

## Tool discovery

OOMOL MCP uses progressive disclosure. DeepSeek Harness receives a small stable discovery surface instead of every Provider action schema at startup. The model searches for actions, reads the selected guide, then executes the exact action.

## Approval boundary

Before production release, verify that Harness approval UI clearly identifies the underlying Provider, Action, account, and important arguments for a generic MCP execution tool. If the official MCP bridge cannot provide an adequate approval view, add a thin action-aware approval controller without replacing the OOMOL MCP protocol.

Side-effecting MCP calls must not be automatically retried after an ambiguous transport failure. The HTTP Action API supports idempotency keys, but the current MCP `execute_action` contract does not.
