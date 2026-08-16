# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub Security Advisories for this repository. Do not open a public issue containing credentials, access tokens, provider data, or exploit details.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Revoke any exposed OOMOL or Provider credential immediately; do not wait for a repository response.

## Credential boundary

- Provider OAuth tokens and API keys remain in OOMOL Connector.
- DeepSeek Harness stores only a dedicated, revocable OOMOL MCP client key.
- The browser settings card receives configured/source/writable metadata and never the credential value.
- Credentials must not be committed, stored in `cordis.patch.yml`, logged, or included in diagnostics.
- Use a separate OOMOL key for each Harness installation and revoke it when that installation is retired.

## Action safety

Before broad write access is enabled, deployments must verify action-aware approval for externally visible, destructive, permission-changing, and broad-sharing operations. Do not automatically retry side-effecting MCP calls after an ambiguous failure.
