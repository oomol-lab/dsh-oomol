# OOMOL Connections 侧栏多账号能力差距报告

## 1. 结论

当前 `dsh-oomol` Connections 侧栏已经具备“同一个 Provider 下列出多个连接账号、添加新账号、按 appId 断开账号”的基础能力，但还不是完整的多账号管理体验。

核心问题是：侧栏把多个账号当成一组平铺记录展示，却没有建立“当前正在管理哪个账号”和“Agent 默认使用哪个账号”这两个不同概念。因此，用户能看见多个账号，却不能可靠地识别、切换、设置默认或重连指定账号。

与 `console.oomol.com` 相比，当前最重要的六个缺口是：

1. 当前选中账号；
2. 默认账号标识；
3. 将非默认账号设为默认；
4. 对指定现有账号重新授权或更新凭据；
5. 通过别名和 Provider 账号标识区分同类账号；
6. 基于默认账号而不是“任意异常账号”计算 Provider 总体状态。

建议先完成一个紧凑的“多账号最小闭环”，不要把 Console 的全部日志、触发器、凭据详情和团队权限一次性搬进 360–520px 的 Harness 右栏。

### 当前推进状态

本报告生成后的第一轮实现已在当前工作区完成：

- 已增加默认/唯一账号选择纯函数；
- 已增加多账号无默认歧义判断；
- 已修正 Provider 主状态，使非默认备用账号异常不再覆盖默认账号状态；
- 已增加当前账号选择器；
- 已展示 Current 和 Default badge；
- 已增加 `connections/set-default` 固定 BFF；
- 已接通 `PUT /v1/apps/services/:service/default`；
- 已增加“设为默认”；
- 已同时展示 alias 与真实账号身份；
- 已接通现有 appId 的 OAuth/API Key/custom credential 重连路径；
- 已增加账号状态、认证方式和更新时间摘要；
- 已补首次打开列表拉取、Credential 变化后的缓存失效与重新验证；
- 已增加相关 Host sanitizer、默认账号、重连、状态选择和请求通知测试。

仍留待后续阶段：

- alias 编辑；
- 最近执行记录；
- Triggers；
- Credential Summary 和 Scopes；
- Team capability metadata；
- no-auth virtual App 的显式就绪语义。

---

## 2. 对比范围

### Console 参考实现

本报告主要检查：

- `console.oomol.com/src/api/connections.ts`
- `console.oomol.com/src/pages/connections-app-selection.ts`
- `console.oomol.com/src/pages/connections-management-store.ts`
- `console.oomol.com/src/pages/use-connections-management-store.ts`
- `console.oomol.com/src/pages/connections-provider.tsx`
- `console.oomol.com/src/pages/connections-activity-panels.tsx`
- `console.oomol.com/src/pages/use-connector-app-detail.ts`
- `console.oomol.com/src/i18n/common/en.json`
- `console.oomol.com/src/i18n/common/zh-CN.json`

### Harness 侧栏当前实现

主要检查：

- `dsh-oomol/src/client/connections.tsx`
- `dsh-oomol/src/client/connections-controller.ts`
- `dsh-oomol/src/connections.ts`
- `dsh-oomol/src/client/index.tsx`

---

## 3. Console 已有的多账号模型

Console 使用 `ConnectorAppRecord` 表示一个真实连接账号，关键字段包括：

```ts
interface ConnectorAppRecord {
  id: string
  service: string
  providerAccountId?: string
  accountLabel?: string
  alias: string | null
  aliasNormalized: string | null
  displayName: string
  isDefault: boolean
  status?: "active" | "reauth_required" | "error" | "disconnected"
  authType: ConnectorCredentialAuthType | null
  createdAt: number
  updatedAt: number
}
```

Console 明确区分三个概念：

- **连接账号**：某个 Provider 下的一条 Connector App 记录；
- **当前账号**：用户正在页面中查看和管理的账号；
- **默认账号**：Agent 或未显式指定 appId 的调用默认解析到的账号。

Console 的选择规则是：

```text
优先选择 isDefault=true 的账号
→ 只有一个可管理账号时自动选择它
→ 多个账号但没有默认账号时不静默猜测
```

用于状态展示时，Console 还会在没有默认账号的异常数据下回退到：

```text
默认或唯一账号
→ 第一个 active 账号
→ 第一个可管理账号
```

这套规则避免了多账号场景下“随便取数组第一项”的不稳定行为。

---

## 4. 当前 Harness 侧栏已经具备的能力

### 4.1 列出多个账号

`connections/list` 返回的 App 已经包含：

```ts
id
service
displayName
accountLabel
alias
authType
status
isDefault
createdAt
updatedAt
```

当前侧栏会按 Provider 分组，并在 Provider 行展示连接数量：

```text
Connected · 2
```

进入 Provider 后，也会把所有账号平铺到“已连接账号”区域。

### 4.2 添加另一个账号

当前 UI 已支持：

- OAuth；
- API Key；
- custom credential；
- no-auth；
- “添加另一个连接”。

### 4.3 按 appId 断开指定账号

侧栏断开接口使用：

```text
DELETE /v1/apps/by-id/:appId
```

因此不会因为同一 Provider 有多个账号而误删其他账号。

### 4.4 BFF 已保留部分重连基础

Host BFF 的 `connections/connect` 输入已经支持可选 `appId`，并能把路径切换为：

```text
/v1/apps/by-id/:appId/connect
```

但当前 `ConnectionForm` 从未传入 `appId`，所以这个能力还没有形成用户可用的重连流程。

---

## 5. 重要功能缺口

### 5.1 没有“当前选中账号”模型（P0）

当前 ProviderView 直接 `apps.map()` 平铺所有账号，每行只有状态点、名称、认证类型和断开按钮。

缺少：

- selectedAppId；
- 当前账号标识；
- 账号选择器；
- 账号切换后的详情区域；
- 创建新账号与管理现有账号之间的模式区分。

直接后果：

- 无法明确后续“重连、设为默认、改名、查看日志”作用于哪个账号；
- 多个账号名称相近时难以识别；
- 所有账号都占用垂直空间，账号多时右栏迅速变长；
- 破坏性操作与普通账号切换混在同一层级。

#### 建议

在 Provider 详情头部增加紧凑账号选择器：

```text
[ Connection: Work Gmail      ⇅ ]  [Default]
```

下拉菜单行展示：

```text
连接名称或主要账号标签
Provider 账号标签 / ID
[Current] [Default] [Needs reauth]
```

账号选择只改变当前管理对象，不自动改变默认账号。

---

### 5.2 `isDefault` 已传到浏览器，但 UI 完全忽略（P0）

Host 的 `sanitizeApp()` 已保留：

```ts
isDefault: source.isDefault === true
```

Client 的 `ConnectedApp` 也声明了：

```ts
isDefault: boolean
```

但 ProviderView 没有展示 Default badge，也没有使用默认账号进行初始选择或状态计算。

#### 用户影响

- 用户不知道 Agent 默认会用哪个账号；
- 多账号都处于 active 时无法判断执行目标；
- 删除默认账号前没有额外认知提示；
- 用户可能误以为“当前列表第一项”就是默认账号。

#### 建议

- 当前默认账号显示 `Default / 默认` badge；
- 非默认账号详情显示“设为默认”；
- 默认账号变更后，同一 Provider 下旧默认账号必须同步变为 `isDefault=false`；
- 默认账号不等于当前选中账号，两者 badge 要分开。

---

### 5.3 缺少“设为默认”操作和 BFF 端点（P0）

Console 使用：

```text
PUT /v1/apps/services/:service/default
body: { appId }
```

当前 `dsh-oomol` BFF 只有：

```text
connections/list
connections/provider
connections/connect
connections/disconnect
```

没有 set-default RPC，也没有 PUT 方法支持。

#### 建议的 BFF 契约

```text
connections/set-default
payload: { service, appId }
```

Host 固定转发到：

```text
PUT /v1/apps/services/:service/default
body: { appId }
```

返回值必须经过 `sanitizeApp()`，不得把远端原始对象直接传给浏览器。

客户端成功后应：

1. 更新目标账号为默认；
2. 清除同 Provider 旧默认账号标记；
3. 重新请求权威列表；
4. 保持当前选中账号不变；
5. 显示成功反馈。

---

### 5.4 缺少多账号歧义状态（P0）

如果一个 Provider 有多个可用账号，但没有任何 `isDefault=true`，当前侧栏仍只显示：

```text
Connected · N
```

它没有告诉用户 Agent 的默认执行目标不明确。

#### 建议

Provider 行和 Provider 详情都应识别：

```text
manageableApps.length > 1 && !apps.some(app => app.isDefault)
```

并显示：

```text
Choose default / 请选择默认账号
```

该状态应比普通 Connected 更醒目，但不应伪装成 Provider 授权失败。

---

### 5.5 Provider 总体状态计算不适合多账号（P0）

当前列表页使用：

```ts
const needsAttention = apps.some((app) => app.status !== "active")
```

这意味着：

```text
默认账号 active
非默认备用账号 reauth_required
→ 整个 Provider 显示 Needs attention
```

这种聚合会让用户误以为 Agent 的默认连接不可用。

反向场景也需要明确：默认账号异常、非默认账号 active 时，Provider 应优先提示默认账号需要处理，而不是简单选择任意 active 账号掩盖问题。

#### 建议

先实现统一纯函数：

```text
pickDefaultOrSingleApp
pickStatusApp
deriveProviderConnectionState
```

建议状态优先级：

1. 多账号无默认：`ambiguous`；
2. 默认账号存在：以默认账号状态为主；
3. 只有一个账号：以唯一账号状态为主；
4. 无默认的历史异常数据：回退到 active，再回退到第一条；
5. 非当前账号异常可以显示次级 attention count，不覆盖主状态。

---

### 5.6 缺少账号别名编辑和身份消歧（P1）

当前侧栏主标签是：

```ts
app.alias || app.accountLabel || app.displayName
```

一旦存在 alias，就不再显示真实 Provider 账号标签；没有 alias 时，多个同名账号也可能无法区分。

Console 的做法是：

- alias 作为主要名称；
- accountLabel / providerAccountId 作为次级身份；
- 支持 `PATCH /v1/apps/by-id/:appId` 修改 alias；
- 空 alias 明确显示“未设置连接名称”。

#### 建议

账号菜单始终展示两层信息：

```text
Work Gmail                 ← alias 或主要标签
being@example.com          ← accountLabel/providerAccountId
```

增加 BFF：

```text
connections/update-alias
payload: { appId, alias }
```

如果第一阶段暂不实现编辑，也至少应同时显示 alias 和 accountLabel，避免同名账号不可辨认。

---

### 5.7 缺少指定账号重连（P1）

当前 ProviderView 下方的 ConnectionForm 永远创建新连接，无法对某个 `reauth_required` 或 `error` 账号重新授权。

虽然 BFF `ConnectInput` 已支持 `appId`，但 Client 没有把选中账号传入。

#### 建议

- 选中账号后显示 `Reconnect / 重新连接`；
- OAuth、API Key、custom credential 都把选中 `appId` 传给 `connections/connect`；
- “Add connection”继续走 service-scoped create；
- “Reconnect”走 appId-scoped reconnect；
- 两者必须是不同动作，不能靠表单上下文猜测。

---

### 5.8 状态表达过于粗糙（P1）

当前账号行只有：

- 绿色点：active；
- 黄色点：其他所有状态。

但后端实际区分：

```text
active
reauth_required
error
disconnected
```

#### 建议

- `active`：Active / 正常；
- `reauth_required`：Reauth required / 需要重新授权，并给 Reconnect CTA；
- `error`：Failed / 异常，允许查看简化原因或前往 Console；
- `disconnected`：不进入可管理账号选择器；
- 状态必须有文字，不能只依赖颜色点。

---

### 5.9 缺少选中账号的关键元数据（P1）

Console 会展示：

- alias；
- connected account；
- status；
- default status；
- auth type；
- updated time；
- appId；
- trigger callback URLs；
- credential summary；
- scopes。

Harness 右栏不应完整复制全部字段，但至少需要：

```text
账号显示名
真实账号标签
状态
默认状态
认证方式
最近更新时间
```

appId、Scopes、Credential Summary 可以放进折叠的“Details / 详情”区域或链接到 Console。

---

### 5.10 缺少账号级执行记录（P2）

Console 使用：

```text
GET /v1/apps/by-id/:appId/executions
```

侧栏目前没有任何账号级 Activity/Executions 入口。

这不是多账号切换的首要阻塞，但用户排查“到底是哪一个 Gmail 账号执行了 Action”时非常关键。

#### 建议

第一阶段只提供：

```text
View activity in Console / 在 Console 查看活动
```

第二阶段再考虑在右栏增加懒加载的最近 10 条执行记录。

---

### 5.11 Team scope 和管理权限未显式表达（P2）

Console 根据 `scopeWritable` 决定用户是否可以：

- 添加账号；
- 重连；
- 断开；
- 设为默认；
- 编辑别名；
- 管理 Team access。

Harness 侧栏目前默认渲染所有管理操作，主要依赖后端拒绝越权请求。

#### 建议

- BFF 返回安全的 capability metadata，例如 `canManageConnections`；
- 只读用户隐藏或禁用管理动作；
- Team identity 继续由 Harness Host 决定，浏览器不要自行拼接 Team Header；
- Team access policy 的高级配置继续留在 Console。

---

### 5.12 no-auth Provider 的虚拟 App 语义未对齐（P2）

Console 将 `no_auth:<service>` 视为虚拟就绪记录，并从“真实可管理账号”中排除。

当前 BFF 的 identifier 白名单不接受 `:`，因此这类虚拟记录会被 sanitize 掉。结果是 no-auth Provider 可能被 UI 当成“没有连接”，再次显示连接表单。

#### 建议

- 明确 BFF 是否应该传递 `noAuthReady`，不要直接放宽所有 appId identifier；
- no-auth 就绪状态与真实多账号列表分离；
- no-auth Provider 不显示默认账号和账号选择器。

---

## 6. 能力差距矩阵

| 能力 | Console | 当前 Harness 侧栏 | 优先级 |
| --- | --- | --- | --- |
| 同 Provider 多账号列表 | 完整 | 已有基础列表 | 已有 |
| 添加另一个账号 | 完整 | 已有 | 已有 |
| 按 appId 断开 | 完整 | 已有 | 已有 |
| 当前选中账号 | 有 | 无 | P0 |
| Default badge | 有 | 数据有、UI 无 | P0 |
| 设为默认 | 有 | 无 API、无 UI | P0 |
| 多账号无默认警告 | 有明确选择语义 | 无 | P0 |
| 基于默认账号的 Provider 状态 | 有 | 使用 `some(non-active)` | P0 |
| alias + account 双层标签 | 有 | 只显示其中一个 | P1 |
| 编辑 alias | 有 | 无 | P1 |
| 指定账号重连 | 有 | BFF 有基础、UI 未接入 | P1 |
| 细分账号状态 | 有 | 仅颜色点 | P1 |
| 账号元数据 | 完整 | 极少 | P1 |
| 账号级执行记录 | 有 | 无 | P2 |
| Triggers | 有 | 无 | P2 |
| Team/RBAC 管理态 | 有 | 无显式 capability | P2 |
| no-auth 虚拟状态 | 有 | 未对齐 | P2 |

---

## 7. 推荐的 Harness 侧栏交互

Harness 右栏宽度只有 300–520px，应使用“选择一个账号进行管理”，而不是复制 Console 的完整大页面。

推荐结构：

```text
← All apps

[Provider icon] Gmail

Connection
[ Work Gmail                       ⇅ ] [Default]

下拉菜单：
  Work Gmail
  being@example.com             [Current] [Default]

  Personal Gmail
  personal@example.com

  Backup Gmail
  backup@example.com            [Needs reauth]

  ─────────────────────────────────────
  + Add connection

Selected connection
  Status                Active
  Account               being@example.com
  Authentication        OAuth
  Default connection    Current default
  Updated               2026-08-17 12:30

[Reconnect] [Set default] [Disconnect]

▸ Details
▸ Recent activity
```

### 交互规则

- 切换当前账号不会改变默认账号；
- 设为默认不会强制切换当前账号；
- 添加账号成功后自动选择新账号；
- 重连成功后保持选中同一 appId；
- 断开当前账号后选择新的默认账号、唯一账号或空态；
- 默认账号异常时 Provider 行显示 Needs attention；
- 非默认账号异常时显示次级提示，不覆盖默认账号主状态；
- 多账号无默认时显示 Choose default，而不是 Connected。

---

## 8. 推荐实施阶段

### Phase 1：多账号最小闭环（必须先做）

#### Client

- 增加纯函数：group/manageable/default/status selection；
- 增加 `selectedAppId`；
- 增加账号选择器；
- 展示 Current 和 Default badge；
- 增加 Set default；
- 修复 Provider 聚合状态；
- 显示 alias + accountLabel 双层身份；
- 断开后选择稳定 fallback；
- 补全中英文文案和无障碍名称。

#### Host BFF

- 增加 `connections/set-default`；
- `requestConnector` 支持 PUT；
- 固定 service/appId 校验；
- 返回 sanitized App；
- 保持永久 MCP Key 不进入浏览器。

#### 验收价值

完成后，用户能回答：

```text
我现在管理的是哪个账号？
Agent 默认会使用哪个账号？
如何把另一个账号设成默认？
多个账号没有默认时该怎么办？
```

### Phase 2：账号维护闭环

- 编辑 alias；
- 指定 appId 重连；
- 细分 reauth/error 状态；
- 展示核心账号元数据；
- Add connection 与 Reconnect 分离；
- 账号选择与 OAuth 新建完成后的 selection reconciliation。

Host BFF 增加：

```text
connections/update-alias
connections/app-detail（如确有需要）
```

`connections/connect` 复用现有可选 appId 契约。

### Phase 3：高级管理入口

- 最近执行记录；
- Triggers；
- Credential Summary；
- Scopes；
- Team capability metadata；
- 高级功能统一链接到 OOMOL Console。

---

## 9. 数据和 API 设计建议

### 9.1 复用当前已有字段

当前 `ConnectedApp` 已经包含 `isDefault`、`alias`、`accountLabel`、`status`，Phase 1 不需要先新增一套数据模型。

建议补充：

```ts
providerAccountId?: string
```

并由 Host `sanitizeApp()` 限长、去空白后返回。

### 9.2 新增 BFF endpoint

```ts
connections/set-default
payload: {
  service: string
  appId: string
}
```

固定转发：

```text
PUT /v1/apps/services/:service/default
```

Phase 2：

```ts
connections/update-alias
payload: {
  appId: string
  alias: string | null
}
```

固定转发：

```text
PATCH /v1/apps/by-id/:appId
```

所有远端返回必须经过 sanitizer，不允许透传原始错误和原始对象。

### 9.3 Client 状态建议

```ts
type AccountSelection =
  | { mode: "auto" }
  | { mode: "selected"; appId: string }
  | { mode: "new"; previousAppIds: Set<string>; fallbackAppId: string }
```

这能覆盖：

- 默认选择；
- 用户手动切换；
- 创建新连接后自动选择新 appId；
- 新建失败时回退；
- 当前账号被断开后的稳定 fallback。

如果侧栏第一阶段不实现复杂 Store，至少要把选择和 fallback 逻辑提取成纯函数并单测，避免散落在 JSX 中。

---

## 10. 必要测试矩阵

### 选择规则

- 一个账号、无默认：自动选择唯一账号；
- 多个账号、有默认：选择默认账号；
- 多个账号、无默认：进入歧义状态；
- 默认账号 disconnected：不选择已断开的账号；
- 默认账号 reauth_required：仍选择默认账号并展示 Reconnect；
- 手动选择非默认账号：保持 Current 与 Default 分离。

### 设置默认

- 非默认账号设为默认；
- 新默认变为 true；
- 旧默认同步变为 false；
- 请求失败时不做虚假成功更新；
- Team scope 正确携带 Host 已解析的范围；
- appId/service 非法时在 BFF 拒绝。

### 新建和重连

- Add connection 不携带 appId；
- Reconnect 必须携带选中 appId；
- 新建成功自动选择新 appId；
- 重连成功保持原 appId；
- OAuth popup 被拦截时 selection 不改变；
- 重复 Provider 账号返回 conflict 时引导选择已有连接。

### 断开

- 断开非默认账号不改变默认选择；
- 断开默认账号后使用服务端权威列表选择新默认/唯一账号；
- 断开当前账号后不保留已删除 selection；
- 删除 Key 或切换身份后清空所有旧账号状态。

### Provider 聚合状态

- 默认 active + 非默认 reauth：主状态 Connected，次级 attention；
- 默认 reauth + 非默认 active：主状态 Needs attention；
- 多账号无默认：Choose default；
- 全部 disconnected：Not connected；
- 只有 no-auth virtual app：Ready，不显示账号选择器。

### I18N 与可访问性

- Current、Default、Set default、Choose default、Reconnect、Add connection 全部双语；
- 账号选择器有明确 aria-label；
- 不能仅通过颜色表达状态；
- 长 alias、账号邮箱和 Provider Account ID 正确省略，并能通过 title/详情读取。

---

## 11. 不建议的实现方式

- 不要继续在 Provider 详情中平铺无限账号行；
- 不要把“列表第一项”当默认账号；
- 不要让“当前选中”隐式改变“默认账号”；
- 不要因为任意非默认账号异常就把整个 Provider 标记为不可用；
- 不要直接在浏览器调用 Connector API；所有管理操作继续经过固定 BFF；
- 不要把远端原始错误、Credential 或 Header 返回给浏览器；
- 不要为了多账号功能复制整个 Console 页面进 Harness；
- 不要在 Phase 1 同时加入日志、Triggers、Team access 等高级功能，避免主流程失焦。

---

## 12. 最终建议

优先实现 Phase 1：账号选择器、Current/Default 标识、Set default、歧义状态和 Provider 状态修正。这是多账号体验从“能看到多条记录”升级为“能够可靠管理和控制 Agent 默认身份”的最小闭环。

Phase 2 再加入 alias 编辑和指定账号重连；Phase 3 才考虑日志、Triggers、Credential Summary 和 Team capability。

从现有代码基础看，Phase 1 的改造成本可控：`isDefault` 和 appId 已经进入浏览器，断开也已是 appId-scoped；主要新增的是一个固定的 set-default BFF、账号选择状态和正确的聚合逻辑。真正需要避免的是继续在当前平铺列表上叠按钮，否则账号越多，选择语义和破坏性操作会越难理解。
