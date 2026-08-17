# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub Security Advisories for this repository. Do not open a public issue containing credentials, access tokens, provider data, or exploit details.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Revoke any exposed OOMOL or Provider credential immediately; do not wait for a repository response.

## Credential boundary

- Provider OAuth tokens and stored API keys remain in OOMOL Connector. A credential entered in the Connections drawer is forwarded once through the loopback-fenced Host bridge and is not persisted by the plugin.
- DeepSeek Harness stores only a dedicated, revocable OOMOL MCP client key.
- Browser code receives only MCP-key configured/source/writable metadata and sanitized connection data; it never receives the stored MCP key or stored Provider credentials.
- Credentials must not be committed, stored in `cordis.patch.yml`, logged, or included in diagnostics.
- Use a separate OOMOL key for each Harness installation and revoke it when that installation is retired.

## Action safety

Before broad write access is enabled, deployments must verify action-aware approval for externally visible, destructive, permission-changing, and broad-sharing operations. Do not automatically retry side-effecting MCP calls after an ambiguous failure.
