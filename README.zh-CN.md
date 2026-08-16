# dsh-oomol

这是面向 DeepSeek Harness 的 OOMOL Connector 插件：连接应用并调用 Actions。

当前实现使用 DeepSeek Harness 官方 Streamable HTTP MCP Client，连接 OOMOL 的渐进式 Connector MCP Endpoint。Workflow 不属于当前版本的能力范围。

Gmail、Slack、Notion、GitHub 等 Provider 的 OAuth Token 和 API Key 继续保存在 OOMOL Connector 中；DeepSeek Harness 只持有一个专用、可撤销的 OOMOL MCP Client Key。

## 当前状态

这是一个经过隔离 profile 安装和 Web 启动验证的 Host + Web Plugin，兼容基线为 DeepSeek Harness `0.1.0-rc.6`。DeepSeek Harness 仍处于 Developer Preview，正式发布前需要持续验证新版本兼容性。

当前版本包含：

- 标准 `dsh.bundle` 包；
- 通过 Harness Credentials Service 或启动环境解析凭据；
- OOMOL 托管 MCP Endpoint；
- 可选 Team 身份；
- 复用 DSH 官方 MCP Client 的工具发现、注册、超时和重连；
- 无 Key 时正常启动，配置或轮换 Key 后自动重建 MCP Client；
- Settings > Plugins 下的 OOMOL Key 配置卡片；
- MCP 初始化与渐进式发现检测，以及不会泄露远端错误文本的连接状态；
- Key 通过 Harness Credentials Service 只写保存，浏览器永远不会回读明文；
- 确保 Secret 不进入 Bundle 配置的测试。

浏览器无密钥复制配对和 Action 级策略仍在后续路线图中，详见 [架构](./docs/ARCHITECTURE.md) 和 [路线图](./docs/ROADMAP.md)。

## 开发

```bash
pnpm install
pnpm check
```

运行不会打印凭据值的环境检查：

```bash
pnpm run doctor
```

使用真实 OOMOL MCP Client Key 验证托管 MCP 初始化和渐进式发现：

```bash
OOMOL_MCP_API_KEY=... pnpm verify:connector
```

## 从本地目录安装

```bash
pnpm build
dsh plugin --profile web add -w /Users/wushuang/code/dsh-oomol
```

启动 DeepSeek Harness 后可在 **设置 > 插件 > 插件配置 > OOMOL Connector** 中保存专用 MCP Key。Key 只会写入 Harness Credentials Service，页面只读取“是否已配置、来源和是否可写”。

也可以在启动 DeepSeek Harness 前通过环境变量提供 Key：

```bash
export OOMOL_MCP_API_KEY="api_..."
dsh web
```

使用 Team 身份时再设置：

```bash
export OOMOL_TEAM_NAME="your-team"
```

使用 Personal 身份时不要设置 `OOMOL_TEAM_NAME`。

`oo` CLI 用于登录、诊断、安装引导和独立验证；普通 Action 调用直接走 OOMOL MCP，不会为每次工具调用启动 CLI，也不会读取 OOCLI 的内部认证文件。

## 安全约束

- 不要把 OOMOL Key 或 Provider Credential 提交到 Git。
- DeepSeek Harness 应使用独立、可撤销的 MCP Key。
- Provider Credential 始终留在 OOMOL Connector。
- 对外可见写操作、删除操作和广泛分享操作必须在执行前审查。
- 正式开放写能力前，必须完成 Action 级审批体验验证。
- MCP `execute_action` 不具备 HTTP Action API 的 Idempotency-Key 能力；结果未知的写操作不得自动重试。

## License

MIT
