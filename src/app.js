/* Vulcan WebSocket OPC UA 浏览器客户端
 *
 * 按 docs/08-websocket-transport.md §5 选型使用 @wsopcua/wsopcua：
 *   - 浏览器内直连 OPC UA WebSocket 端点（wss://，opcua+uacp 子协议）；
 *   - 能力：连接/会话、读、写、浏览（订阅/方法调用留待后续页面扩展）。
 *
 * 构建：npm run build（esbuild 打包为 dist/app.js，页面直接引入）。
 */
import {
  AttributeIds,
  DataType,
  DataValue,
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  Variant,
  WriteValue,
  coerceNodeId,
} from '@wsopcua/wsopcua';

const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');

let client = null;
let session = null;

function log(message, className) {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function variantDisplay(v) {
  if (v == null) return '<null>';
  if (v.dataType === DataType.String) return String(v.value);
  if (Array.isArray(v.value)) return `[${v.value.join(', ')}]`;
  return String(v.value);
}

function setConnected(connected) {
  document.getElementById('disconnect').disabled = !connected;
  document.getElementById('write').disabled = !connected;
}

async function ensureSession() {
  if (session) return session;
  throw new Error('未连接');
}

async function onConnect() {
  const url = document.getElementById('url').value.trim();
  if (!/^wss?:\/\//.test(url)) {
    log(`端点 URL 必须以 ws:// 或 wss:// 开头: ${url}`, 'err');
    return;
  }
  try {
    client = new OPCUAClient({
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpoint_must_exist: false,
      connectionStrategy: { maxRetry: 1 },
    });
    setStatus(`连接 ${url} ...`);
    await client.connectP(url);
    session = await client.createSessionP({});
    setStatus(`已连接: ${url}`);
    log(`连接成功（${url}），会话已建立`, 'ok');
    setConnected(true);
  } catch (err) {
    setStatus('连接失败');
    log(`连接失败: ${err.message || err}`, 'err');
    client = null;
    session = null;
  }
}

async function onDisconnect() {
  try {
    if (session) await session.closeP();
    if (client) await client.disconnectP();
    log('已断开', 'ok');
  } catch (err) {
    log(`断开异常: ${err.message || err}`, 'err');
  }
  session = null;
  client = null;
  setStatus('未连接');
  setConnected(false);
}

async function onRead() {
  const nodeId = coerceNodeId(document.getElementById('nodeId').value.trim());
  try {
    const s = await ensureSession();
    const dv = await s.readVariableValueP(nodeId);
    log(`读 ${nodeId.toString()} = ${variantDisplay(dv.value?.value)}`, 'ok');
  } catch (err) {
    log(`读失败: ${err.message || err}`, 'err');
  }
}

async function onWrite() {
  const nodeId = coerceNodeId(document.getElementById('nodeId').value.trim());
  const text = document.getElementById('value').value;
  let dataType = DataType.String;
  let parsed = text;
  if (text === 'true' || text === 'false') {
    dataType = DataType.Boolean;
    parsed = text === 'true';
  } else if (/^-?\d+$/.test(text)) {
    dataType = DataType.Int64;
    parsed = BigInt(text);
  } else if (/^-?\d*\.\d+$/.test(text)) {
    dataType = DataType.Double;
    parsed = Number(text);
  }
  try {
    const s = await ensureSession();
    const statusCode = await s.writeP(
      new WriteValue({
        nodeId,
        attributeId: AttributeIds.Value,
        value: new DataValue({
          value: new Variant({ value: parsed, dataType }),
        }),
      })
    );
    log(`写 ${nodeId.toString()} = ${text} -> ${statusCode.description}`, 'ok');
    const dv = await s.readVariableValueP(nodeId);
    log(`读回 ${nodeId.toString()} = ${variantDisplay(dv.value?.value)}`, 'ok');
  } catch (err) {
    log(`写失败: ${err.message || err}`, 'err');
  }
}

async function onBrowse() {
  const from = coerceNodeId(document.getElementById('browseFrom').value.trim());
  try {
    const s = await ensureSession();
    const result = await s.browseP(from);
    for (const ref of result.results[0].references || []) {
      log(`  ${ref.browseName.name}: ${ref.nodeId.toString()}`);
    }
    log(`浏览 ${from.toString()} 完成`, 'ok');
  } catch (err) {
    log(`浏览失败: ${err.message || err}`, 'err');
  }
}

document.getElementById('connect').addEventListener('click', onConnect);
document.getElementById('disconnect').addEventListener('click', onDisconnect);
document.getElementById('read').addEventListener('click', onRead);
document.getElementById('write').addEventListener('click', onWrite);
document.getElementById('browse').addEventListener('click', onBrowse);
window.addEventListener('beforeunload', () => {
  if (client) client.disconnectP();
});
