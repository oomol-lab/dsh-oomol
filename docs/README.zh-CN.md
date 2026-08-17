# dsh-oomol

[English](../README.md)

这是面向 DeepSeek Harness 的 OOMOL Connector 插件：连接应用并调用 Actions。

当前实现使用 DeepSeek Harness 官方 Streamable HTTP MCP Client，连接 OOMOL 的渐进式 Connector MCP Endpoint。Workflow 不属于当前版本的能力范围。

Gmail、Slack、Notion、GitHub 等 Provider 的 OAuth Token 和 API Key 继续保存在 OOMOL Connector 中；DeepSeek Harness 只持有一个专用、可撤销的 OOMOL MCP Client Key。

## 快速开始

### 准备条件

- Node.js `22.19` 或更高版本，或 Node.js `24+`；
- DeepSeek Harness；
- 一个 [OOMOL Console](https://console.oomol.com/) 账号。

### 1. 安装插件

推荐把下面这段提示词粘贴到具有终端权限的 DeepSeek Harness 会话中：

```text
请使用官方 dsh plugin CLI，把最新稳定版 OOMOL Connector 插件
（dsh-oomol）安装到我的 DeepSeek Harness web profile。

安装前确认 Node.js 版本不低于 22.19，并确认 dsh CLI 可用。不要使用
sudo，不要索取、读取、打印或保存任何 API Key，也不要修改无关的
Harness profile 或配置。

安装后验证插件已经成功添加。如果必须重启当前 Harness，请不要终止本
会话，只告诉我准确的重启命令。然后指导我前往“设置 > 插件 > OOMOL
Connector”配置 OOMOL MCP API Key。如果安装失败，请停止并展示原始错误，
不要尝试无关的变通方案。
```

也可以手动安装到 Web profile：

```bash
dsh plugin --profile web add -w dsh-oomol
```

### 2. 重启 DeepSeek Harness

插件会在 Harness 重启后生效：

```bash
dsh web
```

打开终端输出的地址。

### 3. 获取 OOMOL MCP API Key

打开 [OOMOL Console](https://console.oomol.com/)，注册或登录账号。在左侧展开 **More**，进入 **API Keys**，找到 **OOMOL MCP API key** 区域，点击 **Show** 并复制其中的 Key。

请使用 **OOMOL MCP API key** 区域里的 Key，不要使用上方的 Default API key，也不要使用下方的 User keys。

![在 OOMOL Console 获取 MCP API Key](./images/oomol-console-mcp-api-key.png)

这个 Key 是专门用于 Harness 的 OOMOL MCP 客户端 Key，不是 DeepSeek 模型 API Key，也不是 Gmail、Notion、GitHub 等 Provider 的凭据。请把它当作 Secret：不要发到聊天中、提交到 Git，或在截图中显示它的值。

### 4. 在 DeepSeek Harness 中配置 Key

1. 打开 DeepSeek Harness 的 **设置**；
2. 选择 **插件**；
3. 保持在 **插件配置** 标签页；
4. 找到并展开 **OOMOL Connector**；
5. 粘贴 MCP Key，点击 **保存 Key**；
6. 点击 **测试连接**；
7. 确认连接状态变为 **已连接**。

保存成功后，卡片会显示 **已配置**，并提示 MCP Key 已安全保存。Harness 不会再次显示已保存的值；只有轮换 Key 时才需要使用 **更换 Key**。

![在 DeepSeek Harness 中配置 OOMOL Connector](./images/deepseek-harness-oomol-settings.png)

浏览器只会收到 Key 是否已配置、来源和是否可写，不会收到已保存的 Key 明文。

### 5. 打开连接中心并连接应用

测试连接成功后，在会话标题栏点击 **连接**。OOMOL 连接中心会在 Harness 官方右侧详情栏中打开；可以搜索应用，并完成 OAuth、API Key 或其他凭据连接流程。

![在 DeepSeek Harness 中打开 OOMOL 连接中心](./images/deepseek-harness-connections.png)

Provider OAuth Token 和 Provider API Key 始终保存在 OOMOL Connector 中，DeepSeek Harness 只保存专用的 OOMOL MCP Key。

看到以下结果就说明配置成功：

- **设置 > 插件** 中出现 OOMOL Connector；
- 卡片显示 **已配置**；
- **测试连接** 显示 **已连接**；
- 会话标题栏的 **连接** 按钮可以打开右侧面板；
- 已连接应用出现在列表中。

### 6. 开始使用

建议先使用只读的发现提示词：

```text
显示这个 OOMOL 账号当前可用的连接器。
```

```text
查找我的 Notion 连接器支持哪些 Actions，先不要执行。
```

对于有副作用的操作，要求 Harness 先展示参数并等待确认：

```text
准备一个向已连接的表格添加一行的 Action。先展示目标账号、Action 名称和
准备写入的值，得到我的确认后再执行。
```

## 当前状态

这是一个遵循 DeepSeek Harness 官方 Bundle、Client Slot、Credentials 和 MCP Client 标准的 Host + Web Plugin，不修改 Harness 源码。项目通过隔离 Profile 安装、Web 启动和自动化测试验证发布质量。

当前版本包含：

- 标准 `dsh.bundle` 包；
- 通过 Harness Credentials Service 或启动环境解析凭据；
- OOMOL 托管 MCP Endpoint；
- 可选 Team 身份；
- 复用 DSH 官方 MCP Client 的工具发现、注册、超时和重连；
- 无 Key 时正常启动，配置或轮换 Key 后自动重建 MCP Client；
- Settings > Plugins 下的 OOMOL Key 配置卡片；
- 会话标题栏中可打开的原生右侧连接详情面板；
- 在详情面板中查看、添加和断开 Connector 账号，OAuth 通过弹窗继续；
- OOMOL 授权与 Provider Catalog 检测，以及不会泄露远端错误文本的连接状态；
- Key 通过 Harness Credentials Service 只写保存，浏览器永远不会回读明文；
- 确保 Secret 不进入 Bundle 配置的测试。

免复制 MCP Key 的配对流程和 Action 级策略仍在后续路线图中，详见 [架构](./ARCHITECTURE.md) 和 [路线图](./ROADMAP.md)。

## 开发

```bash
pnpm install
pnpm check
```

运行不会打印凭据值的环境检查：

```bash
pnpm run doctor
```

使用真实 OOMOL MCP Client Key 验证 Connector 授权和 Provider Catalog：

```bash
OOMOL_MCP_API_KEY=... pnpm verify:connector
```

## 从本地目录安装

```bash
pnpm build
dsh plugin --profile web add -w /Users/wushuang/code/dsh-oomol
```

启动 DeepSeek Harness 后可在 **设置 > 插件 > 插件配置 > OOMOL Connector** 中保存专用 MCP Key。Key 只会写入 Harness Credentials Service，页面只读取“是否已配置、来源和是否可写”。

测试连接成功后，点击会话标题栏的 **连接**，即可在 Harness 原生右侧详情面板里新增、查看和断开 Connector 账号。该面板只使用官方 `details` slot 和 `ctx.layout` 开关服务，因此宽度、拖动缩放、响应式让步和会话行为均由 Harness 管理。插件设置卡片中的 **管理连接** 会打开完整 OOMOL Console。永久 MCP Key 始终留在 Harness Host，不会放进页面 URL，也不会返回给浏览器；在表单中输入的 Provider API Key 或自定义凭据只会单次转发给 OOMOL Connector，本插件不会保存。

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
