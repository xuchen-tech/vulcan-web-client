# vulcan-web-client

基于 **Vue 3 + Vite + TypeScript** 的浏览器 OPC UA 客户端（UaExpert 风格），经 WebSocket 直连本 fork 的 `vulcan_server`。OPC UA 协议栈使用 [`@wsopcua/wsopcua`](https://www.npmjs.com/package/@wsopcua/wsopcua)（与 `vulcan/web` 一致）。

详细需求、设计与分阶段实施见 [docs/README.md](docs/README.md)。

## 前置条件

| 依赖 | 说明 |
| --- | --- |
| Node.js | **>= 18**（见 `package.json` engines） |
| npm | 随 Node 安装 |
| vulcan_server | 联调/冒烟需启用 WebSocket 端点（见下文） |

## 安装与编译

```bash
cd vulcan-web-client
npm install
```

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式（Vite 热更新，默认 `http://localhost:5173`） |
| `npm run build` | 类型检查 + 生产构建，产物在 `dist/` |
| `npm run preview` | 本地预览 `dist/` 静态站点（默认 `http://localhost:4173`） |
| `npm run test` | Vitest 单元测试（**无需**启动服务器） |
| `npm run test:e2e` | Node 端到端冒烟（**需** `vulcan_server --ws` 已运行） |
| `npm run smoke` | Vitest + e2e 一键冒烟（`test/run_smoke.sh`） |

## 运行（联调 vulcan_server）

### 1. 启动 OPC UA 服务器

在**另一个终端**启动 `vulcan_server`（TCP 4840 + 明文 WebSocket 4843，开发联调常用）：

```bash
# 在仓库根目录；需已构建 vulcan（见 ../vulcan/README.md）
./vulcan/build/vulcan_server 4840 --ws 4843
```

说明：

- 不带 `--pki` 时 WebSocket 为明文 **`opc.ws://`**，浏览器端点 URL 使用 `ws://…/opcua`。
- 带 `--pki` 时为 **`opc.wss://`**（TLS），需 `wss://…/opcua` 及 Basic256Sha256 + 客户端证书；详见 [../vulcan/README.md](../vulcan/README.md) 阶段 8 章节。

启动成功后日志中应出现类似：

```text
websocket endpoint opc.ws://0.0.0.0:4843/opcua
```

### 2. 启动前端开发服务器

```bash
cd vulcan-web-client
npm run dev
```

浏览器打开 Vite 输出的地址（通常 `http://localhost:5173`）。

### 3. 连接参数（开发默认）

连接栏已预填与上述服务器一致的默认值：

| 项 | 值 |
| --- | --- |
| URL | `ws://127.0.0.1:4843/opcua` |
| Security | `None` |
| Policy | `None` |
| Identity | `Anonymous` |

点击 **Connect**。成功时状态为「已连接」，底部日志出现「会话建立成功」。

> 使用 `127.0.0.1` 而非 `localhost`，是为避免部分环境下 `localhost` 解析到 IPv6 `::1` 而 WebSocket 只监听 IPv4 导致连接失败。

### 4. 生产构建部署（可选）

```bash
npm run build
npm run preview   # 或把 dist/ 部署到任意静态 HTTP 服务器
```

## 自动化测试

### 单元测试（Vitest）

不依赖 `vulcan_server`，适合 CI 与日常开发：

```bash
npm run test
```

覆盖：URL/安全策略校验、format/类型推断、store mock、日志与错误处理 helper 等。

### 端到端冒烟（Node + wsopcua）

假定 `vulcan_server` **已在运行**（同上 `4840 --ws 4843`）：

```bash
# 仅 e2e
npm run test:e2e

# Vitest + e2e 一键（推荐联调收尾）
npm run smoke
```

也可直接：

```bash
bash test/run_smoke.sh
```

冒烟步骤（`test/e2e_smoke.mjs`）：

1. WebSocket 连接 + 建立会话  
2. 浏览 RootFolder (`i=84`)  
3. 读/写/读回 `ns=3;s=CONFIG.RESOURCE1.Task1.Drive.Speed`  
4. 对 `Counter` 创建 Subscription + MonitoredItem（等待通知或读回退）  
5. 调用标准方法 `Server.GetMonitoredItems`（可选，`WSOPCUA_SKIP_METHOD=1` 跳过）  

环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `WSOPCUA_URL` | `ws://127.0.0.1:4843/opcua` | WebSocket 端点 |
| `WSOPCUA_SPEED_NODE` | `ns=3;s=CONFIG.RESOURCE1.Task1.Drive.Speed` | 读写变量 |
| `WSOPCUA_COUNTER_NODE` | `ns=3;s=CONFIG.RESOURCE1.Task1.PLC.Counter` | 订阅/写入变量 |
| `WSOPCUA_USER` / `WSOPCUA_PASSWORD` | — | 可选；明文 `opc.ws://` 端点通常仅 Anonymous，写值会 SKIP |
| `WSOPCUA_SKIP_METHOD` | — | 设为 `1` 跳过方法 Call |

wss + 证书自动化可参考 `vulcan/web/test/run_ws_web_client_test.sh`（SignAndEncrypt 场景）。

## 手动浏览器联调（全流程）

在 `vulcan_server` 与 `npm run dev` 均已启动的前提下：

### 连接与会话

1. 打开 `http://localhost:5173`，确认三栏布局 + 底部 Log 面板。  
2. Connect → 状态绿点「已连接」。  
3. Disconnect → 「未连接」。  
4. 停止 server 后 Connect → 「失败」+ **Reconnect**，页面不崩溃。

### 地址空间 / 属性 / 引用

1. 连接后左侧展开 **Root → Objects → PlcType → …**  
2. 选中 Variable（如 **Counter**），右侧 Attributes 显示 NodeClass、DataType、Value 等。  
3. References 面板列出正/反向引用。

### 读 / 写 Value

1. 选中可写 Variable（如 **Speed** / **Counter**）。  
2. Attributes 面板 **读 Value** / **写 Value**（对话框输入，写后读回）。

### Data Access 监视

1. 选中 Variable → **加入监视**（或拖到 Data Access 区域）。  
2. 监视表出现一行，Value 随 server 假数据更新。  
3. 可调整发布/采样间隔，行内写值、移除行。

### 方法调用（可选）

1. 展开 **Objects → Server**，选中 Method（如 **GetMonitoredItems**）。  
2. Attributes → **调用方法**，查看入参/出参定义并执行 Call。

### 日志

- 底部 Log 支持级别筛选、自动滚动、毫秒时间戳。  
- 任一面板失败时，Log 出现 ERR/WARN，其他面板仍可操作。

### 开发者工具

- **Console**：无未捕获异常。  
- **Network → WS**：Connect 后可见 `4843` WebSocket 二进制帧。

## 目录结构（简要）

```text
vulcan-web-client/
├── src/
│   ├── opcua/           # OPC UA service 层（client/browse/readwrite/subscription/method…）
│   ├── stores/          # Pinia stores
│   ├── components/      # UI 面板与对话框
│   └── App.vue
├── test/
│   ├── e2e_smoke.mjs    # Node 端到端冒烟
│   ├── run_smoke.sh     # Vitest + e2e 一键脚本
│   ├── browser_shim.mjs # Node WebSocket/crypto shim
│   └── **/*.test.ts     # Vitest 单元测试
├── docs/                # 需求 / 设计 / 实施文档
└── dist/                # npm run build 产物
```

## 相关文档

- [docs/README.md](docs/README.md) — 需求、设计、分阶段验收（阶段 0–8）  
- [docs/03-implementation.md](docs/03-implementation.md) — 各阶段 AC 清单  
- [../vulcan/README.md](../vulcan/README.md) — 构建与启动 `vulcan_server`  
- [../docs/08-websocket-transport.md](../docs/08-websocket-transport.md) — WebSocket 传输说明  
