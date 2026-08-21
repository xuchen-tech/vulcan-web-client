# vulcan-web-client 文档

基于 Web（浏览器）的 OPC UA 客户端，功能参考 UaExpert，经 WebSocket（`opc.wss://`）
直连本 fork 的 vulcan_server。技术栈 Vue 3 + Vite + TypeScript，OPC UA 库沿用
`@wsopcua/wsopcua`（与 ../vulcan/web 一致）。

| 文档 | 内容 |
| --- | --- |
| [01-requirements.md](01-requirements.md) | UaExpert 功能盘点 + 首版（核心对齐）需求 FR/NFR + 非目标 |
| [02-design.md](02-design.md) | 架构分层、目录结构、OPC UA service 层、UI 布局、测试策略、风险 |
| [03-implementation.md](03-implementation.md) | 阶段 0–8 实施步骤，每步产出、做法要点与验收标准（AC） |

联调依赖：../../docs/08-websocket-transport.md（WebSocket 传输选型）、
../vulcan/README.md（vulcan_server 的 wss 端点启动与冒烟）。

阅读顺序：01 → 02 → 03。
