# vulcan-web-client 设计文档

> 承接 [01-requirements.md](01-requirements.md)。本文给出 Vue 3 + Vite + TS 的
> 架构、模块划分、OPC UA service 层设计、UI 布局、数据流、错误处理与测试策略。

## 1. 技术选型

| 关注点 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | Vue 3（`<script setup>` + Composition API） | 组件化、上手快，适合面板/树/表密集的 UaExpert 式 UI |
| 构建 | Vite | Vue 官方推荐，dev server 快，产物走 Rollup |
| 语言 | TypeScript（strict） | 类型安全，OPC UA 属性/枚举多，类型约束收益大 |
| OPC UA 客户端 | `@wsopcua/wsopcua` | 与 vulcan/web 一致；浏览器内直连 wss，支持连接/会话/读/写/浏览/订阅/方法 |
| 状态管理 | Pinia | Vue 3 官方状态库；连接态、地址空间缓存、监视表集中管理 |
| UI 组件 | 轻量自研 + 少量基础库（可选 Element Plus 的 Tree/Table） | UaExpert 式三栏 + 树/表；首版可先自研，避免过度依赖 |
| 测试 | Vitest（单元）+ Node `ws` 端到端冒烟脚本 | service 层可测；沿用 vulcan/web/test 思路对 vulcan_server 联调 |

> 说明：`@wsopcua/wsopcua` 派生自 node-opcua 客户端，API 以 `*P`（Promise）后缀方法为主
> （`connectP`/`createSessionP`/`readVariableValueP`/`writeP`/`browseP`/`closeP`/
> `disconnectP`），订阅与方法调用 API 在集成阶段以库实际导出为准（见 §6 风险）。

## 2. 目录结构

```text
vulcan-web-client/
├── docs/
│   ├── 01-requirements.md
│   ├── 02-design.md
│   └── 03-implementation.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                 # 应用入口，挂载 Vue + Pinia
│   ├── App.vue                 # 顶层布局（三栏 + 连接栏 + 日志）
│   ├── opcua/                  # OPC UA service 层（不含任何 Vue 依赖）
│   │   ├── client.ts           # OpcuaClientService：连接/会话生命周期
│   │   ├── browse.ts           # 浏览封装（Browse + BrowseNext）
│   │   ├── attributes.ts       # 属性批量读取
│   │   ├── references.ts       # 引用读取
│   │   ├── readwrite.ts        # 读/写 Value（含类型推断/转换）
│   │   ├── subscription.ts     # Subscription + MonitoredItem 管理
│   │   ├── method.ts           # 方法调用
│   │   ├── types.ts            # 领域类型（NodeInfo/AttrRow/RefRow/MonitorRow…）
│   │   └── format.ts           # Variant/StatusCode/时间戳的展示格式化
│   ├── stores/
│   │   ├── connection.ts       # Pinia：连接状态、当前会话句柄引用
│   │   ├── address-space.ts    # Pinia：树节点缓存、选中节点
│   │   ├── monitor.ts          # Pinia：监视表行、订阅句柄
│   │   └── log.ts              # Pinia：全局日志
│   ├── components/
│   │   ├── ConnectionBar.vue   # 连接栏（URL/安全/身份/连接按钮/状态）
│   │   ├── AddressSpaceTree.vue# 左栏：地址空间树（懒加载）
│   │   ├── AttributesPanel.vue # 右上：属性表
│   │   ├── ReferencesPanel.vue # 右中：引用表
│   │   ├── DataAccessView.vue  # 中栏底部：监视表（读写就地）
│   │   ├── MethodCallDialog.vue# 方法调用对话框
│   │   ├── WriteValueDialog.vue# 写值对话框
│   │   └── LogPanel.vue        # 底部：日志
│   └── shared/
│       └── nodeclass-icons.ts  # NodeClass → 图标映射
└── test/
    ├── e2e_smoke.mjs           # 对 vulcan_server --ws 的端到端冒烟
    └── run_smoke.sh
```

## 3. 分层架构

```
┌─────────────────────────────────────────────┐
│ Components (Vue)  连接栏/树/属性/引用/监视/日志  │  只读 store、触发 action
├─────────────────────────────────────────────┤
│ Stores (Pinia)   connection/address-space/... │  编排 service，缓存状态
├─────────────────────────────────────────────┤
│ OPC UA service (纯 TS，无 Vue)                 │  封装 @wsopcua/wsopcua
├─────────────────────────────────────────────┤
│ @wsopcua/wsopcua  →  wss  →  vulcan_server     │
└─────────────────────────────────────────────┘
```

关键原则（对应 NFR-4）：**协议细节只存在于 `src/opcua/`**。组件与 store 只操作领域
类型（`NodeInfo`、`AttrRow`、`MonitorRow`…），不直接 import `@wsopcua/wsopcua` 的
Variant/DataType（格式化统一走 `opcua/format.ts`）。

## 4. OPC UA service 层设计

### 4.1 OpcuaClientService（client.ts）
- 持有单个 `OPCUAClient` + `session`。
- `connect(opts)`：校验 URL、构造 client（securityMode/policy/userIdentity）、
  `connectP` → `createSessionP`；返回连接结果或抛错。
- `disconnect()`：关闭 session、断开 client，幂等。
- `getSession()`：供其他 service 使用；未连接抛 `NotConnectedError`。
- 事件：暴露状态回调（connecting/connected/closed/reconnecting/failed）供 store 订阅。

### 4.2 浏览（browse.ts）
- `browse(nodeId, opts)`：调用会话 `browseP`，默认 `HierarchicalReferences`、
  `browseDirection=Forward`、`resultMask=all`；处理 `continuationPoint`（BrowseNext）。
- 返回 `NodeInfo[]`：`{ nodeId, browseName, displayName, nodeClass, typeDefinition, hasChildren? }`。

### 4.3 属性（attributes.ts）
- `readAttributes(nodeId)`：对属性 ID 列表批量 `read`；每项独立带 StatusCode，
  失败项以占位返回（FR-3.3）。
- 输出 `AttrRow[]`：`{ attribute, value, statusCode }`，Value 行附带
  DataType/时间戳/StatusCode。

### 4.4 引用（references.ts）
- `readReferences(nodeId)`：`browseP` 全部引用类型、双向，输出 `RefRow[]`：
  `{ referenceType, isForward, target: NodeInfo }`。

### 4.5 读写（readwrite.ts）
- `readValue(nodeId)` → DataValue。
- `writeValue(nodeId, input)`：类型推断（Boolean/Int/Double/String，数组按逗号分隔），
  或按已知 DataType 强制转换；组装 `WriteValue` + `writeP`；写后回读（FR-6.2）。

### 4.6 订阅（subscription.ts）
- `SubscriptionManager`：懒创建单个 Subscription（可配 publishingInterval）。
- `monitor(nodeId, opts)`：创建 MonitoredItem（samplingInterval/queueSize/discardOldest），
  注册数据变化回调 → 更新监视表行。
- `unmonitor(clientHandle)`：删除 MonitoredItem。
- `dispose()`：断开时清理订阅。

### 4.7 方法调用（method.ts）
- `readMethodArguments(objectId, methodId)`：读 Method 的 InputArguments/OutputArguments
  属性（Argument 结构体数组）。
- `call(objectId, methodId, inputs)`：组装 `CallMethodRequest` → `callP`；返回
  outputArguments + statusCode。

### 4.8 格式化（format.ts）
- `variantToDisplay(variant)`、`statusCodeToText(sc)`、`nodeClassName(n)`、
  `dateTimeToLocal(ts)`。集中处理数组、结构体（尽力展示）、null。

## 5. UI 布局（UaExpert 式三栏）

```
┌───────────────────────────────────────────────────────────┐
│ ConnectionBar: [URL] [Security▾] [Identity▾] [Connect]  ●状态 │
├──────────────┬───────────────────────┬─────────────────────┤
│ AddressSpace │  DataAccessView(监视表) │ AttributesPanel      │
│  Tree        │  NodeId Value TS SC ✎  │ (选中节点属性)        │
│ (懒加载树)    │                        ├─────────────────────┤
│              │                        │ ReferencesPanel      │
│              │                        │ (选中节点引用)        │
├──────────────┴───────────────────────┴─────────────────────┤
│ LogPanel: [time] [level] message                            │
└───────────────────────────────────────────────────────────┘
```

- 选中树节点 → 触发 `address-space` store 的 `select(nodeId)` →
  并发读属性 + 引用 → 刷新右栏。
- 树节点/属性面板提供“加入监视”“写值”“调用方法”入口。
- 首版采用固定三栏（CSS grid），可停靠布局列为后续。

## 6. 数据流与错误处理

- 所有 service 方法返回 Promise，store action 内 try/catch，失败写 `log` store 并置
  面板局部错误态（NFR-6）；不 throw 到组件渲染层。
- 连接状态机：`disconnected → connecting → connected → (reconnecting) → disconnected/failed`。
- 断线：`OPCUAClient` 的重连策略首版设为不自动重连或有限重试，UI 提供手动重连。

## 7. 测试策略

- 单元（Vitest）：`format.ts` 纯函数；类型推断/转换（readwrite）逻辑；store action 用
  mock service。
- 端到端冒烟（Node + `ws`）：`test/e2e_smoke.mjs` 直接用 `@wsopcua/wsopcua` 对
  `vulcan_server --ws` 跑 连接→浏览→读→写→订阅一拍→方法（若模型含），沿用
  vulcan/web/test 的 browser_shim 思路在 Node 提供 WebSocket。
- 联调对象：`../../docs/08-websocket-transport.md` 的 `opc.wss://` 启动方式。

## 8. 已知风险与开放项

- R-1 `@wsopcua/wsopcua` 的订阅/方法 API 名称与签名需在集成阶段以库实际导出核实
  （现有 vulcan/web 仅用到 连接/读/写/浏览）。若订阅 API 不完备，退化为轮询 read。
- R-2 wss + 非 None 安全策略需服务端证书信任与浏览器 TLS 处理；首版联调以 None/None
  或浏览器已信任证书为主，安全策略打通列为集成阶段验证点。
- R-3 结构体/自定义类型解码依赖服务端 DataTypeDefinition 与库能力，首版只读尽力展示。
- R-4 大地址空间树的性能（懒加载 + 虚拟滚动），首版先懒加载，虚拟滚动按需引入。
