# DeepSeek Harness 的 OOMOL Connector 插件

通过渐进式 MCP 发现，在 DeepSeek Harness 中使用 OOMOL Connector Actions。

`dsh-oomol` 支持 OOMOL Hosted 和自行部署的 OpenConnector。一个插件实例连接一个 Connector endpoint。

[npm package](https://www.npmjs.com/package/dsh-oomol) | [English](../README.md)

## 运行要求

- Node.js 22.19 或更高的 Node.js 22 版本，或 Node.js 24+
- DeepSeek Harness
- OOMOL Hosted 使用 OOMOL 账号；self-hosted 使用已运行的 OpenConnector

## 安装

将插件安装到 Web profile，然后重启 Harness：

```bash
dsh plugin --profile web add -w dsh-oomol
dsh web
```

插件会出现在 **设置 > 插件 > OOMOL Connector**。

## OOMOL Hosted

插件默认连接 OOMOL Hosted：

```yaml
- id: oomol
  name: dsh-oomol
  config:
    endpoint: https://connector.oomol.com/v1/mcp
    teamNameEnv: OOMOL_TEAM_NAME
    serverName: oomol
    toolCallTimeoutMs: 60000
    failOnStartupError: false
```

在 [OOMOL Console](https://console.oomol.com/api-key) 创建 OOMOL MCP API Key，然后保存到插件设置。Harness Credentials 使用 `OOMOL_MCP_API_KEY` 保存它。

托管环境可以在启动时提供：

```bash
export OOMOL_MCP_API_KEY="api_..."
dsh web
```

团队身份通过环境变量设置：

```bash
export OOMOL_TEAM_NAME="your-team"
dsh web
```

会话中的 Connections 按钮会打开 Harness 原生面板，用于管理 OOMOL Hosted 账号。

## Self-hosted OpenConnector

在 profile 的 `cordis.patch.yml` 中覆盖 endpoint：

```yaml
- update:
    id: oomol
    config:
      endpoint: http://127.0.0.1:3000/mcp
```

插件会将官方地址之外的 endpoint 识别为 self-hosted。本地 OpenConnector 可以使用无鉴权部署。启用 runtime 鉴权后，插件使用 `OOMOL_CONNECT_RUNTIME_TOKEN` 中的 API Key：

```bash
export OOMOL_CONNECT_RUNTIME_TOKEN="oct_..."
dsh web
```

也可以在插件设置中保存 Runtime API Key。持久 Runtime Key 由 OpenConnector Console 的 Access 页面创建。

Self-hosted HTTP endpoint 仅支持 `localhost`、`127.0.0.1` 和 `[::1]`。远程部署使用 HTTPS：

```yaml
- update:
    id: oomol
    config:
      endpoint: https://connect.example.com/mcp
```

Connections 按钮会打开 endpoint 的 origin。例如 `https://connect.example.com/mcp` 对应 `https://connect.example.com`。

## 自定义 API Key 环境变量

两种模式都可以指定 credential reference：

```yaml
- update:
    id: oomol
    config:
      endpoint: https://connect.example.com/mcp
      apiKeyEnv: MY_CONNECT_RUNTIME_TOKEN
```

Harness Credentials 的优先级高于启动环境。

## 使用 Connector Actions

从查找能力开始：

```text
列出当前账号可用的 connectors。
```

```text
查找可以创建日历事件的 Actions，并读取选中 Action 的 schema。
```

涉及外部写入时，在执行前明确目标账号和参数。

## 工作原理

插件通过选定 endpoint 挂载 DeepSeek Harness 的 Streamable HTTP MCP client。Connector Actions 按需发现，Harness 只保留少量稳定的 MCP 工具。

OOMOL Hosted 的 Provider credentials 保存在 OOMOL Connector。Self-hosted 的 Provider credentials 保存在 OpenConnector。Harness 只保存 `apiKeyEnv` 指向的 Connector client key。

浏览器只接收 credential reference 和连接状态。Connector API Key 与 Provider credentials 始终位于 Host 侧的 Secret 边界内。

实现细节见[架构说明](./ARCHITECTURE.md)。

## 配置参考

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `endpoint` | `https://connector.oomol.com/v1/mcp` | Streamable HTTP MCP endpoint |
| `apiKeyEnv` | 根据 endpoint 推导 | Harness credential reference 和启动环境变量名 |
| `teamName` | 未设置 | OOMOL Hosted 团队身份 |
| `teamNameEnv` | `OOMOL_TEAM_NAME` | OOMOL Hosted 团队环境变量名 |
| `serverName` | `oomol` | Harness MCP 工具命名空间 |
| `toolCallTimeoutMs` | `60000` | 工具调用超时 |
| `failOnStartupError` | `false` | MCP 发现失败时终止 Harness 启动 |

默认 credential reference：

| Endpoint 模式 | 默认引用 | 是否必填 |
| --- | --- | --- |
| OOMOL Hosted | `OOMOL_MCP_API_KEY` | 是 |
| Self-hosted | `OOMOL_CONNECT_RUNTIME_TOKEN` | 由 OpenConnector 部署决定 |

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 设置中没有插件 | 安装到 `web` profile 并重启 `dsh web` |
| OOMOL Hosted 显示未配置 | 在插件设置中保存 OOMOL MCP API Key |
| Self-hosted 返回未授权 | 保存该 OpenConnector 实例创建的 Runtime API Key |
| Self-hosted Console 链接返回 404 | 打开 OpenConnector 部署所配置的 Console 地址 |
| 缺少预期应用 | 在对应 Connector Console 中配置 Provider connection |
| Connections 面板没有展开 | 将窗口放大到至少 1220 px，以便 Harness 显示详情栏 |

运行本地诊断：

```bash
pnpm run doctor
```

## 安全

- Connector API Key 保存在 Harness Credentials 或启动环境中。
- 远程 self-hosted endpoint 使用 HTTPS。
- 执行删除、公开发布、权限变更和大范围共享等操作前核对目标与参数。
- 副作用调用出现不确定结果时，先在 Provider 中确认结果。
- 安全问题通过 [SECURITY.md](../SECURITY.md) 报告。

## 开发

```bash
pnpm install --frozen-lockfile
pnpm check
```

构建并安装当前 checkout：

```bash
pnpm build
dsh plugin --profile web add -w "$(pwd)"
```

许可证：MIT
