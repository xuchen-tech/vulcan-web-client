# vulcan-web-client 需求梳理（参考 UaExpert）

> 目标：实现一个基于 Web（浏览器）的 OPC UA 客户端，功能参考 Unified Automation
> UaExpert。本文先梳理 UaExpert 的功能，再据此定义本项目**首版（核心对齐）**的需求
> 与非目标。
>
> 传输约束：浏览器只能走 WebSocket（OPC UA Part 14，`opc.wss://` / `opc.ws://`，
> 子协议 `opcua+uacp` 二进制 / `opcua+uajson`），不能走 `opc.tcp://`。服务端需开启
> `UA_ENABLE_LWS`（见 ../../docs/08-websocket-transport.md）。Web 客户端库沿用现有
> `vulcan/web` 的选型 `@wsopcua/wsopcua`。

## 1. UaExpert 功能盘点（参考基线）

UaExpert 是桌面 OPC UA 通用客户端，核心能力如下（作为需求来源清点，非全部纳入首版）：

| 分类 | UaExpert 能力 | 说明 |
| --- | --- | --- |
| 连接/服务器 | 添加服务器、Discovery（GetEndpoints/FindServers）、端点选择、安全策略与模式选择、用户身份（匿名/用户名密码/证书）、多会话并存、重连 | 连接向导 + 服务器列表 |
| 证书/PKI | 客户端应用实例证书生成与信任管理、服务端证书信任决策（trust/reject）、PKI 目录 | 首次连接的信任对话框 |
| 地址空间 | 树形浏览 AddressSpace（Root/Objects/Types/Views）、按引用类型/节点类展开、图标区分节点类、正反向引用、懒加载 | 左侧 Address Space 面板 |
| 属性 | Attributes 面板：展示所选节点全部属性（NodeId、NodeClass、BrowseName、DisplayName、Value、DataType、AccessLevel、Historizing 等） | 右侧 Attributes 面板 |
| 引用 | References 面板：列出所选节点的引用（引用类型、方向、目标 NodeId/BrowseName/类型定义） | 右侧 References 面板 |
| Data Access | Data Access View：把节点拖入监视表，周期/订阅刷新 Value、SourceTimestamp、ServerTimestamp、StatusCode，就地写值 | 核心插件 |
| 订阅 | 创建 Subscription、MonitoredItem（采样间隔、队列、数据变化过滤、死区），数据变化通知 | 订阅模型 |
| 读写 | 读单/多属性、写 Value（含类型/数组/结构体的输入）、写其他可写属性 | |
| 方法调用 | Call Method：输入参数编辑、执行、输出参数展示 | |
| 历史数据 | History Trend View：HistoryRead 原始/处理值，曲线/表格展示 | 插件 |
| 事件/告警 | Event View：订阅 Event Notifier、条件/告警（A&C）列表与确认 | 插件 |
| 诊断 | Server Diagnostics：ServerStatus、会话/订阅诊断计数器 | |
| 性能/日志 | Performance View、日志面板、请求/响应耗时 | |
| 工程管理 | 项目保存/加载（服务器列表、监视表、文档布局）、可停靠面板布局 | |
| 数据类型 | 结构体/枚举/联合体的解码与展示、自定义类型（读服务器 DataTypeDefinition） | |

## 2. 首版范围（核心对齐）

首版目标：在浏览器内复刻 UaExpert 最常用的“连接 → 浏览 → 看属性/引用 → 监视 →
读写 → 调方法 → 订阅”闭环。历史趋势、A&C 事件、服务器诊断详表、工程持久化、
可停靠布局 列为后续阶段（见 §4 非目标）。

### FR-1 连接与会话管理
- FR-1.1 支持输入端点 URL（`wss://` / `ws://`），校验协议前缀。
- FR-1.2 连接前可选安全模式（None / Sign / SignAndEncrypt）与安全策略（None /
  Basic256Sha256 等库支持项）；首版默认 None/None，其余项在 UI 暴露但以库能力为准。
- FR-1.3 用户身份：匿名（首版必做）、用户名/密码（首版做）、证书（后续）。
- FR-1.4 显示连接状态（未连接/连接中/已连接/失败/重连中）与错误信息。
- FR-1.5 断开连接，页面卸载自动断开。
- FR-1.6 单连接优先；多服务器列表列为后续。

### FR-2 地址空间浏览
- FR-2.1 从 Root（`i=84`）起树形浏览，节点懒加载（点击展开时 Browse）。
- FR-2.2 每个节点显示 BrowseName/DisplayName，按 NodeClass 区分图标
  （Object/Variable/Method/ObjectType/…）。
- FR-2.3 支持从任意节点继续浏览其正向引用（HierarchicalReferences 优先，可切换全部引用）。
- FR-2.4 选中节点驱动右侧 Attributes / References 面板刷新。

### FR-3 属性面板（Attributes）
- FR-3.1 读取并展示所选节点的全部可读属性（至少：NodeId、NodeClass、BrowseName、
  DisplayName、Description、Value、DataType、ValueRank、ArrayDimensions、
  AccessLevel、UserAccessLevel、Historizing、MinimumSamplingInterval）。
- FR-3.2 Value 属性展示值、DataType 名称、StatusCode、SourceTimestamp、ServerTimestamp。
- FR-3.3 属性读取失败（BadNotReadable 等）以状态码占位，不阻断其他属性。

### FR-4 引用面板（References）
- FR-4.1 展示所选节点的引用：引用类型、方向（正/反）、目标 NodeId、BrowseName、
  TypeDefinition（若有）。
- FR-4.2 双击目标可在地址空间树中定位/展开该节点（尽力而为）。

### FR-5 Data Access 监视表
- FR-5.1 把地址空间中的 Variable 节点加入监视表（按钮或拖拽）。
- FR-5.2 通过 Subscription + MonitoredItem 周期刷新，展示 Value、DataType、
  SourceTimestamp、ServerTimestamp、StatusCode。
- FR-5.3 可配置发布间隔（Subscription publishingInterval）与采样间隔
  （MonitoredItem samplingInterval）。
- FR-5.4 从监视表移除节点（删除 MonitoredItem）。
- FR-5.5 监视表就地写值（见 FR-6）。

### FR-6 读写
- FR-6.1 读任意节点的 Value（一次性读）。
- FR-6.2 写 Value：根据目标 DataType 推断/选择输入类型（Boolean/整型/浮点/String，
  数组以逗号分隔）；写后回读校验。
- FR-6.3 写失败展示 StatusCode 与描述。
- FR-6.4 结构体/联合体写入列为后续（首版只读展示）。

### FR-7 方法调用（Call）
- FR-7.1 选中 Method 节点，读取其 InputArguments / OutputArguments 定义。
- FR-7.2 编辑输入参数（按参数 DataType 提供输入），执行 Call。
- FR-7.3 展示 OutputArguments 与调用 StatusCode。

### FR-8 日志/状态
- FR-8.1 全局操作日志面板（时间戳 + 级别 + 消息），沿用现有 vulcan/web 的日志体验。
- FR-8.2 关键错误（连接失败、读写失败、订阅失败）落到日志并在 UI 提示。

## 3. 非功能需求（NFR）

- NFR-1 传输：仅 WebSocket；库为 `@wsopcua/wsopcua`（与 vulcan/web 一致）。
- NFR-2 技术栈：Vue 3 + Vite + TypeScript；组件化、类型安全。
- NFR-3 运行环境：现代浏览器（Chromium/Firefox 最新版）；纯前端，无自建后端。
- NFR-4 可维护性：OPC UA 交互封装为独立 service 层，UI 组件不直接持有协议细节。
- NFR-5 安全：wss 场景需处理服务端证书信任（浏览器 TLS 由浏览器把关；应用层
  SecurityPolicy 以库能力为准），敏感项（用户名密码）不持久化到明文存储。
- NFR-6 健壮性：单个面板的请求失败不导致整页崩溃；断线有明确状态与手动重连。
- NFR-7 兼容：以本 fork 的 `opc.wss://` 端点为联调对象（vulcan_server --ws）。
- NFR-8 可测试：service 层可在 Node 环境用 `ws` 做端到端冒烟（沿用 vulcan/web/test 思路）。

## 4. 非目标 / 后续阶段（首版不做）

- 历史趋势 History Trend View（HistoryRead + 曲线）。
- 事件/告警 A&C（Event View、条件确认）。
- 服务器诊断详表（会话/订阅诊断计数器）。
- 工程持久化（服务器列表、监视表、布局保存/加载）与可停靠布局。
- 多服务器/多会话并存管理器。
- 证书身份登录、客户端应用实例证书的浏览器内生成与信任管理 UI。
- 结构体/联合体/自定义类型的写入编辑器（首版只读展示解码值）。
- Discovery（FindServers/FindServersOnNetwork）服务器发现向导。

> 后续阶段将以本文 §1 UaExpert 清点为待办池，按价值分批纳入。
