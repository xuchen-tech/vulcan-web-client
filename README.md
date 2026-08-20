# vulcan-web-client

基于 **@wsopcua/wsopcua** 的浏览器 OPC UA WebSocket 客户端（选型见
`docs/08-websocket-transport.md` §5）。浏览器直连 OPC UA 服务器的
`wss://` 端点（`opcua+uacp` 二进制子协议），支持连接/会话、读、写、
浏览地址空间；页面卸载自动断开。

## 目录结构

```text
web/
├── index.html          # 浏览器页面（连接/读/写/浏览）
├── src/app.js          # 页面逻辑（@wsopcua/wsopcua）
├── test/
│   ├── browser_shim.mjs        # Node 端浏览器全局 shim（自动化测试用）
│   ├── ws_web_client_test.mjs  # 端到端测试（同一 wsopcua 客户端）
│   └── run_ws_web_client_test.sh # 一键编排：启动 vulcan_server + 跑测试
├── package.json
└── dist/               # npm run build 产物（gitignore）
```

## 构建

需要 Node.js（浏览器 bundle 用 esbuild；自动化测试用 ws 包做 Node 16
WebSocket shim）。

```bash
npm install
npm run build        # esbuild 打包为 dist/app.js
```

## 使用

将 `index.html` 与 `dist/app.js` 部署到任意静态服务器（或直接浏览器打开
`index.html`），在页面输入 OPC UA WebSocket 端点：

```text
wss://<host>:<port>/opcua
```

然后连接、读/写变量、浏览地址空间。

注意：

- vulcan 的 `--ws` 端点强制 `--pki` 安全模式，会话必须使用与服务端一致的
  Basic256Sha256 + SignAndEncrypt 及客户端证书；页面默认 None 策略仅适用
  于开发环境（需服务端放行）。
- 浏览器访问自签名证书的 `wss://` 端点时，需要先手动信任服务器证书（或
  生产环境使用受信任 CA 签发的证书）。

## 端到端测试（对 vulcan_server 实测）

```bash
./test/run_ws_web_client_test.sh
```

脚本自动完成：

1. 生成临时 pki 目录与客户端证书，客户端证书放入服务端信任目录
   （`<pki>/ApplCerts/trusted/certs/`）；
2. 启动 `vulcan_server <tcp> --pki <pki> --ws <wss>`；
3. 运行 `ws_web_client_test.mjs`：wss 连接 -> 会话 -> 读 ServerStatus/Speed
   -> 写 Speed=21.5 -> 读回 -> 浏览 ObjectsFolder，全部断言通过；
4. 清理退出。

需要可监听本地端口的环境（受限沙箱内需放行网络）。可配置环境变量：
`TCP_PORT`、`WSS_PORT`、`WSOPCUA_NODE_ID`、`WSOPCUA_USER`、
`WSOPCUA_PASSWORD`、`WSOPCUA_CA_FILE`。
