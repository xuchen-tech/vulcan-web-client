# vulcan-web-client

基于 **Vue 3 + Vite + TypeScript** 的浏览器 OPC UA 客户端（UaExpert 风格），经 WebSocket 直连本 fork 的 `vulcan_server`。OPC UA 协议栈使用 [`@wsopcua/wsopcua`](https://www.npmjs.com/package/@wsopcua/wsopcua)（与 `vulcan/web` 一致）。

详细需求、设计与分阶段实施见 [docs/README.md](docs/README.md)。

## 前置条件

| 依赖 | 说明 |
| --- | --- |
| Node.js | **>= 18**（见 `package.json` engines） |
| npm | 随 Node 安装 |
| vulcan_server | 需启用 WebSocket 端点（见下文） |

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
| `npm run test` | Vitest 单元测试（无需启动服务器） |

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

## 前端 Web 页面测试

### 单元测试（Vitest）

不依赖 `vulcan_server`，适合 CI 与日常开发：

```bash
npm run test
```

当前覆盖：工程脚手架、OPC UA URL/安全策略校验、连接 store（非法 URL 拒绝、连接成功/失败日志等）。

### 手动浏览器联调（推荐）

在 `vulcan_server` 与 `npm run dev` 均已启动的前提下，按下列步骤验证：

#### 连接与会话（阶段 1）

1. 打开 `http://localhost:5173`，确认三栏布局与底部日志面板可见，控制台无报错。
2. URL 保持 `ws://127.0.0.1:4843/opcua`，Security/Policy 为 `None`，点击 **Connect**。
3. **预期**：状态点变绿，日志 `会话建立成功`。
4. 点击 **Disconnect**，**预期**：状态回「未连接」，日志 `已断开连接`。
5. **负向**：停止 `vulcan_server` 后点 Connect，**预期**：状态「失败」，日志含连接错误，页面不崩溃。
6. **负向**：URL 改为 `opc.tcp://127.0.0.1:4840` 后 Connect，**预期**：日志提示非法 URL，不发起连接。

#### 地址空间 / 读写在后续阶段验收

当前 UI 中 Address Space、Data Access、Attributes、References 为占位面板；完整浏览、属性、监视、读写等功能按 [docs/03-implementation.md](docs/03-implementation.md) 阶段 2–8 逐步实现。联调时可先用服务端冒烟客户端确认模型与变量可用：

```bash
# TCP 端点读 Server 状态
./vulcan/build/vulcan_smoke_client opc.tcp://127.0.0.1:4840

# 若已加载 demo 模型，可读 Speed 等变量（ns 以启动日志为准）
./vulcan/build/vulcan_smoke_client opc.tcp://127.0.0.1:4840 ns=3;i=6011
```

#### 使用 wss + 证书（生产/安全联调）

1. 启动：`vulcan_server 4840 --pki /path/to/pki --ws 4843`
2. 页面 URL 改为 `wss://127.0.0.1:4843/opcua`
3. Security 选 `SignAndEncrypt`，Policy 选 `Basic256Sha256`
4. 上传已在服务端 `ApplCerts/trusted/certs/` 信任的客户端 PEM 证书与私钥
5. 浏览器首次访问自签名 `wss` 时可能需手动信任服务器证书

更完整的 wss 自动化冒烟见 `vulcan/web/test/run_ws_web_client_test.sh`（Node 端 `@wsopcua/wsopcua`，与浏览器同一协议栈）。

### 浏览器开发者工具检查

联调时打开 DevTools：

- **Console**：不应有未捕获异常；连接失败时错误信息应可读。
- **Network → WS**：Connect 后应看到对 `4843` 的 WebSocket 升级与 UACP 二进制帧（失败时为连接被拒绝或握手错误）。

## 目录结构（简要）

```text
vulcan-web-client/
├── src/
│   ├── opcua/           # OPC UA 客户端封装
│   ├── stores/          # Pinia（connection、log 等）
│   ├── components/      # ConnectionBar、LogPanel 等
│   └── App.vue
├── test/                # Vitest 用例
├── docs/                # 需求 / 设计 / 实施文档
├── dist/                # npm run build 产物
└── package.json
```

## 相关文档

- [docs/README.md](docs/README.md) — 需求、设计、分阶段验收
- [../vulcan/README.md](../vulcan/README.md) — 构建与启动 `vulcan_server`、WebSocket 端点
- [../docs/08-websocket-transport.md](../docs/08-websocket-transport.md) — WebSocket 传输选型
