# Roadmap

## Phase 0 — initial scaffold

- [x] Standard `dsh.bundle` manifest
- [x] Hosted OOMOL MCP endpoint
- [x] Harness credential and launch-environment resolution
- [x] Optional team header
- [x] Official DSH MCP client composition
- [x] Unit tests and environment doctor
- [x] Real DSH Web smoke test in an isolated profile

## Phase 1 — installable MVP

- [ ] Verify authenticated Streamable HTTP initialization against the hosted endpoint (`pnpm verify:connector` is ready; a real key run is pending)
- [ ] Verify progressive tool discovery and structured results (first-page discovery is covered by the verifier; Action execution is pending)
- [ ] Test personal, team, and multiple-connection identities
- [ ] Test 401, 429, 5xx, timeout, reconnect exhaustion, and schema changes
- [ ] Validate action-level approval UX
- [x] Add CI for Node 22 and 24
- [x] Pack and install the exact npm artifact in a clean DSH profile

## Phase 2 — Harness Web experience

- [x] Add `dsh.client` browser bundle
- [x] Add an OOMOL Connector card under Settings > Plugins
- [x] Show connecting, connected, unauthorized/rate-limited, and unavailable states without exposing remote error text
- [ ] Add personal/team selection
- [x] Add a native right-side connection manager plus Console and log fallbacks
- [x] Add Provider OAuth, API-key, custom-credential, no-auth, and disconnect flows to the drawer
- [x] Add an explicit test-connection flow (key rotation also reloads the MCP client)
- [x] Never return credential values to the browser after storage

## Phase 3 — OOMOL Console onboarding

- [ ] Add `deepseek-harness` as an install target
- [ ] Create a dedicated `oomol-deepseek-harness` API key
- [ ] Add install, update, reset, revoke, and uninstall guidance
- [ ] Add Provider and execution-log deep links
- [ ] Add all Console locale keys and onboarding analytics

## Phase 4 — OOCLI integration

- [ ] Detect DeepSeek Harness explicitly in `oo info`
- [ ] Add a DSH-specific doctor command
- [ ] Verify the bundled `oo` skill through `~/.agents/skills`
- [ ] Add optional one-command plugin install and update
- [ ] Keep normal runtime execution on MCP instead of spawning OOCLI per tool call

## Phase 5 — pairing and release

- [ ] Replace copy/paste setup with an expiring pairing transaction
- [ ] Use a dedicated, revocable client key per Harness installation
- [ ] Add action-level policy and approval presentation
- [ ] Publish built npm artifacts with provenance
- [ ] Add the `dsh-plugin` GitHub topic
- [ ] Submit to the community plugin index
- [ ] Publish Chinese and English documentation and a security policy
