# vulcan-web-client 实施步骤与验收标准

> 承接 [01-requirements.md](01-requirements.md) 与 [02-design.md](02-design.md)。
> 每个步骤给出：目标、产出、做法要点、**验收标准（可执行/可观测）**。
>
> 联调服务器：本 fork 的 `vulcan_server`，需启用 `opc.wss://` 端点
> （见 ../../docs/08-websocket-transport.md §2.2 与 ../vulcan/README.md 冒烟章节）。
> 约定示例端点：`ws://localhost:4843/opcua`（None/None，联调用；生产用 wss）。

## 阶段总览

| 阶段 | 内容 | 对应需求 |
| --- | --- | --- |
| 0 | 工程脚手架（Vite + Vue3 + TS + Pinia） | NFR-2/3 |
| 1 | OPC UA service 层：连接/会话 | FR-1 |
| 2 | 地址空间浏览 + 树 UI | FR-2 |
| 3 | 属性 + 引用面板 | FR-3/4 |
| 4 | 读/写 Value | FR-6 |
| 5 | Data Access 监视表（订阅） | FR-5 |
| 6 | 方法调用 | FR-7 |
| 7 | 日志/状态整合与错误处理 | FR-8/NFR-6 |
| 8 | 端到端冒烟测试 + 联调收尾 | NFR-7/8 |

> 每个阶段可独立提交、独立验收。建议顺序执行；2 依赖 1，3/4/5/6 依赖 2。

---

## 阶段 0：工程脚手架

**目标**：可运行的 Vue3+TS+Vite 空壳，Pinia 就绪，能 dev 启动与 build。

**产出**：`package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、
`src/main.ts`、`src/App.vue`、装好 `@wsopcua/wsopcua`、`pinia`、`vitest`。

**做法要点**：
- Vite `vue-ts` 模板结构；`tsconfig` 开 `strict`。
- `main.ts` 挂载 Pinia。
- `App.vue` 先放三栏 CSS grid 占位（连接栏/左树/中监视/右属性引用/底日志）。
- 若 `@wsopcua/wsopcua` 在浏览器需 polyfill（Buffer/process），在 `vite.config.ts`
  配 `define`/`optimizeDeps`（集成阶段按实际报错处理）。

**验收标准**：
- AC-0.1 `npm install` 成功，无致命 peer 冲突。
- AC-0.2 `npm run dev` 启动，浏览器打开可见三栏占位布局，控制台无报错。
- AC-0.3 `npm run build` 产物生成于 `dist/`，无 TS 类型错误。
- AC-0.4 `npm run test` 能运行（可先 0 用例通过）。

---

## 阶段 1：连接/会话 service + 连接栏

**目标**：浏览器内输入端点 URL 连接 vulcan_server，建立/关闭会话，状态可见。

**产出**：`src/opcua/client.ts`、`src/opcua/types.ts`、`src/stores/connection.ts`、
`src/stores/log.ts`、`src/components/ConnectionBar.vue`、`src/components/LogPanel.vue`。

**做法要点**：
- `OpcuaClientService.connect({url, securityMode, securityPolicy, identity})`：
  校验 `^wss?://`，构造 `OPCUAClient`，`connectP` → `createSessionP`。
- 身份：首版匿名 + 用户名/密码（`createSessionP` 传 userIdentityToken）。
- connection store 保存状态机与错误；ConnectionBar 绑定，LogPanel 显示日志。

**验收标准**：
- AC-1.1 输入非法 URL（不以 ws/wss 开头）时拒绝并在日志提示，不发起连接。
- AC-1.2 对运行中的 `vulcan_server --ws 4843`，点击 Connect 后状态变为“已连接”，
  日志出现会话建立成功。
- AC-1.3 服务器未启动时连接失败，状态为“失败”，日志含错误信息，UI 不崩溃。
- AC-1.4 点击 Disconnect 后状态回“未连接”；刷新/关闭页面自动断开（beforeunload）。
- AC-1.5 匿名连接成功；提供用户名/密码字段（有该身份的端点上验证成功，否则至少
  正确传参且失败信息可见）。

---

## 阶段 2：地址空间浏览 + 树 UI

**目标**：从 Root 起懒加载浏览地址空间，树形展示并可选中。

**产出**：`src/opcua/browse.ts`、`src/stores/address-space.ts`、
`src/components/AddressSpaceTree.vue`、`src/shared/nodeclass-icons.ts`。

**做法要点**：
- 初次连接后加载 Root(`i=84`) 子节点；节点展开时按需 Browse（continuationPoint 处理）。
- `NodeInfo` 携带 nodeClass 用于图标；`hasChildren` 可用“展开后为空则标记叶子”。
- 选中节点写入 store 的 `selectedNodeId`。

**验收标准**：
- AC-2.1 连接成功后树根显示 Root/Objects/Types/Views（或服务器实际根引用）。
- AC-2.2 展开 Objects 能看到 Server 节点及模型对象（对 vulcan 模型可见 `ns=3` 节点）。
- AC-2.3 不同 NodeClass 显示不同图标（Object/Variable/Method 可区分）。
- AC-2.4 点击节点后，store `selectedNodeId` 更新（可由后续面板验证）。
- AC-2.5 大量子节点时懒加载不卡死（展开逐层触发，不一次性全量遍历）。

---

## 阶段 3：属性 + 引用面板

**目标**：选中节点后展示其属性与引用。

**产出**：`src/opcua/attributes.ts`、`src/opcua/references.ts`、`src/opcua/format.ts`、
`src/components/AttributesPanel.vue`、`src/components/ReferencesPanel.vue`。

**做法要点**：
- 选中变化 → 并发读属性 + 引用。
- 属性批量 read，失败项以 StatusCode 占位（FR-3.3）。
- Value 行展示 值 / DataType / SourceTs / ServerTs / StatusCode（format.ts）。
- 引用表列出 引用类型 / 方向 / 目标 BrowseName / 目标 NodeId / TypeDefinition。

**验收标准**：
- AC-3.1 选中 Variable 节点，属性面板显示 NodeId、NodeClass、BrowseName、
  DisplayName、DataType、AccessLevel、Value 等，Value 含时间戳与 StatusCode。
- AC-3.2 选中不可读 Value 的节点（如 Object），Value 行显示相应 StatusCode 占位，
  其余属性正常显示，面板不报错。
- AC-3.3 引用面板列出选中节点的正/反向引用，含引用类型名与目标信息。
- AC-3.4 属性/引用读取失败仅影响本面板（局部错误态 + 日志），不影响树与连接。

---

## 阶段 4：读 / 写 Value

**目标**：对任意节点一次性读 Value；对可写节点写 Value 并回读校验。

**产出**：`src/opcua/readwrite.ts`、`src/components/WriteValueDialog.vue`，属性面板/树的
“读”“写”入口。

**做法要点**：
- `readValue(nodeId)` 一次性读，结果进日志/属性面板。
- 写值：按已知 DataType（来自属性面板）或输入推断类型（Boolean/整型/浮点/String，
  数组逗号分隔）组装 `WriteValue` → `writeP`；写后回读（FR-6.2）。
- 写失败展示 StatusCode 描述（FR-6.3）。结构体写入不做（FR-6.4）。

**验收标准**：
- AC-4.1 对一个可读 Variable 点“读”，日志/面板显示当前值与 StatusCode=Good。
- AC-4.2 对一个可写标量 Variable 写入合法值（如 Boolean/Int/Double/String），
  返回 Good，回读值等于写入值。
- AC-4.3 写只读节点或类型不匹配时，返回非 Good StatusCode 并在 UI/日志显示描述，
  不崩溃。
- AC-4.4 数组值以逗号分隔输入可正确写入（在支持数组的节点上验证）。

---

## 阶段 5：Data Access 监视表（订阅）

**目标**：把 Variable 加入监视表，通过 Subscription+MonitoredItem 周期刷新，支持就地写。

**产出**：`src/opcua/subscription.ts`、`src/stores/monitor.ts`、
`src/components/DataAccessView.vue`。

**做法要点**：
- `SubscriptionManager` 懒创建单个 Subscription（可配 publishingInterval）。
- 从树/属性面板“加入监视” → 创建 MonitoredItem（samplingInterval/queueSize），
  数据变化回调更新对应行。
- 行展示 NodeId、Value、DataType、SourceTs、ServerTs、StatusCode；行内“写”“移除”。
- 断开连接时 `dispose()` 清理订阅。
- 若库订阅 API 不完备（风险 R-1），退化为定时轮询 read，并在日志标注降级。

**验收标准**：
- AC-5.1 把一个 Variable 加入监视表后出现一行，Value 列显示当前值。
- AC-5.2 服务器侧值变化时（可用另一路 vulcan_smoke_client 写入，或监视自增变量），
  监视行 Value 与 SourceTimestamp 在发布间隔内自动更新。
- AC-5.3 可配置发布间隔/采样间隔，修改后刷新频率相应变化。
- AC-5.4 从监视表移除某行后，该 MonitoredItem 停止更新（订阅侧已删除）。
- AC-5.5 断开连接后订阅被清理，无残留回调报错；重连后可重新加入监视。
- AC-5.6 监视行就地写值成功并在下次刷新反映新值。

---

## 阶段 6：方法调用

**目标**：选中 Method 节点，读取参数定义、编辑输入、执行 Call、展示输出。

**产出**：`src/opcua/method.ts`、`src/components/MethodCallDialog.vue`。

**做法要点**：
- 读 Method 的 InputArguments/OutputArguments（Argument 结构体数组）。
- 按参数 DataType 生成输入控件，组装 `CallMethodRequest` → 调用。
- 展示 outputArguments 与 StatusCode。

**验收标准**：
- AC-6.1 选中 Method 节点，对话框列出输入/输出参数名与类型（无参方法显示为空列表）。
- AC-6.2 填入合法输入执行 Call，返回 Good 并展示输出参数值。
- AC-6.3 输入非法/权限不足时返回相应 StatusCode 并显示，不崩溃。

> 注：若联调模型无可调用方法，用 `ns=0` 标准方法或在 vulcan 模型中指定一个方法节点验证；
> 无合适方法时至少验证参数读取与请求组装路径（AC-6.1）。

---

## 阶段 7：日志/状态整合与错误处理

**目标**：统一错误处理与日志，保证局部失败不拖垮整页。

**产出**：贯穿各 store 的 try/catch 规范、`LogPanel.vue` 完整化、连接状态机收敛。

**做法要点**：
- 所有 store action try/catch → 写 log store + 置面板局部错误态（NFR-6）。
- 日志分级（info/ok/warn/err），时间戳，滚动到底。
- 连接状态机与 UI 徽标一致。

**验收标准**：
- AC-7.1 任一面板请求失败时，日志出现对应错误项，其他面板与连接不受影响。
- AC-7.2 断线后 UI 状态明确为“未连接/失败”，提供手动重连且重连后功能恢复。
- AC-7.3 日志级别、时间戳正确，长日志可滚动查看。

---

## 阶段 8：端到端冒烟测试 + 联调收尾

**目标**：可重复的端到端冒烟，覆盖核心闭环；与 vulcan_server 实机联调通过。

**产出**：`test/e2e_smoke.mjs`、`test/run_smoke.sh`、`README.md`（启动/联调说明）。

**做法要点**：
- Node + `ws` 提供 WebSocket，用 `@wsopcua/wsopcua` 跑：连接→浏览→读→写→
  订阅一拍→（可选）方法。沿用 vulcan/web/test 的 browser_shim 思路。
- `run_smoke.sh` 假定 `vulcan_server --ws` 已在给定端口运行。
- README 写明：如何起 vulcan_server 的 wss 端点、如何 dev/build、如何跑冒烟。

**验收标准**：
- AC-8.1 `test/run_smoke.sh` 对运行中的 vulcan_server 端到端跑通并退出码 0，
  日志显示各步骤成功。
- AC-8.2 Vitest 单元用例（format/类型推断/store mock）全部通过。
- AC-8.3 手动联调：浏览器打开应用，完成 连接→浏览→选节点看属性/引用→加入监视→
  写值→（可选）调方法 全流程无阻断。
- AC-8.4 README 按步骤可复现启动与联调。

---

## 交付与验收口径

- 每阶段以其 AC 全绿为“完成”；阶段可独立提交。
- 首版整体验收 = 阶段 0–8 的 AC 全部通过 + `01-requirements.md` §2 的 FR-1~FR-8 覆盖。
- 非目标（§4）不在首版验收范围，作为后续阶段待办池。
