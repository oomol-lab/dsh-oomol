# Security Policy

Report vulnerabilities through GitHub Security Advisories for this repository. Include the affected version, reproduction steps, impact, and suggested mitigation. Revoke exposed Connector or Provider credentials immediately.

## Credential boundaries

- Harness Credentials or the launch environment stores the Connector API key.
- OOMOL Connector or OpenConnector stores Provider OAuth tokens and API keys.
- The browser receives credential status and sanitized connection data.
- Cordis patches, diagnostics, logs, and external Console links contain no credential values.

## Endpoint policy

Remote self-hosted endpoints use HTTPS. Plain HTTP is accepted for loopback hosts during local development. Endpoint URLs reject embedded credentials and fragments.

## Action execution

Deployments should present the Provider, Action, account, and important arguments before externally visible, destructive, permission-changing, or broad-sharing operations. An ambiguous side-effecting result requires Provider-side verification before retry.

Removing the plugin leaves Provider connections unchanged. Revoke Connector access in the corresponding OOMOL or OpenConnector Console when an installation should lose access.
