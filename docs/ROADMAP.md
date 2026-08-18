# Roadmap

## Available

- Public npm package and DeepSeek Harness bundle
- OOMOL Hosted MCP connection
- Self-hosted OpenConnector MCP connection
- Endpoint-derived `oomol-hosted` and `self-hosted` modes
- Harness Credentials and launch-environment API key resolution
- Optional self-hosted runtime API key
- Progressive Connector and Action discovery
- Connector Action execution
- MCP-based connection status and manual testing
- Native OOMOL Hosted Connections panel
- External self-hosted OpenConnector Console entry
- OOMOL Hosted personal and environment-selected team identities

## Release validation

- Verify authenticated OOMOL Hosted MCP initialization with a release API key
- Verify self-hosted anonymous MCP initialization against `../connect`
- Verify self-hosted runtime API key authentication against `../connect`
- Run clean-profile installation and Web boot smoke tests
- Test Node.js 22 and 24 packages

## Planned

- Team selection in the OOMOL Hosted settings UI
- Passwordless OOMOL Hosted MCP key pairing
- Action-aware approval presentation
- Additional self-hosted Console URL support when deployments serve the Console below an origin path

## Outside the current scope

- Multiple Connector instances in one Harness profile
- Embedded self-hosted administrative APIs
- Runtime key policy management inside Harness
- Workflow authoring and execution
