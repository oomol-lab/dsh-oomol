# Development guidelines

- Keep the plugin thin: use OOMOL MCP for Connector discovery and execution.
- Keep Provider credentials in OOMOL Connector; never persist them in this repository or a Cordis patch.
- Resolve the OOMOL MCP key through the Harness credentials service first, then the launching environment.
- Do not read OOCLI internal auth files. Add a stable OOCLI integration contract if bootstrap needs one.
- Preserve progressive discovery; do not register every Connector Action as a permanent Harness tool.
- Treat DeepSeek Harness as a fast-moving developer preview dependency and test upgrades explicitly.
- Use `import type` for type-only imports and retain NodeNext `.js` suffixes for local module imports.
- Run `pnpm check` before delivery.
