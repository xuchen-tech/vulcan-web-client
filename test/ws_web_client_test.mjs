/* vulcan WebSocket OPC UA 客户端端到端测试（@wsopcua/wsopcua）
 *
 * 与浏览器页面同一客户端库：连接 wss:// 端点 -> 建立会话 -> 读/写/浏览，
 * 验证 vulcan_server 的 opc.wss:// 传输端到端可用。
 *
 * 用法：
 *   WSOPCUA_URL=wss://localhost:4843/opcua \
 *   WSOPCUA_CLIENT_CERT=<client_cert.pem> \
 *   WSOPCUA_CLIENT_KEY=<client_key.pem> \
 *   node test/ws_web_client_test.mjs
 *
 * 可选：WSOPCUA_CA_FILE=<server_cert.der|pem>（TLS 层信任）；
 *       WSOPCUA_USER / WSOPCUA_PASSWORD（UserName 认证）。
 */
import './browser_shim.mjs';

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
import { PEMDERCertificateStore } from '@wsopcua/wsopcua/common';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(cond, label) {
    if (cond) {
        console.log(`PASS ${label}`);
    } else {
        console.error(`FAIL ${label}`);
        failures += 1;
    }
}

const url = process.env.WSOPCUA_URL || 'wss://localhost:4843/opcua';
const speedNodeId = process.env.WSOPCUA_NODE_ID || 'ns=1;i=6011';
const certFile = process.env.WSOPCUA_CLIENT_CERT;
const keyFile = process.env.WSOPCUA_CLIENT_KEY;

if (!certFile || !keyFile) {
    console.error('WSOPCUA_CLIENT_CERT / WSOPCUA_CLIENT_KEY are required');
    process.exit(2);
}

const cert = readFileSync(certFile, 'utf8');
const key = readFileSync(keyFile, 'utf8');

const client = new OPCUAClient({
    securityMode: MessageSecurityMode.SignAndEncrypt,
    securityPolicy: SecurityPolicy.Basic256Sha256,
    endpoint_must_exist: false,
    connectionStrategy: { maxRetry: 1 },
    clientCertificateStore: new PEMDERCertificateStore(cert, key),
});

let session;
try {
    console.log(`connect ${url} ...`);
    await client.connectP(url);
    check(true, `wss connect ${url}`);

    session = await client.createSessionP({
        userIdentityInfo: process.env.WSOPCUA_USER
            ? { userName: process.env.WSOPCUA_USER, password: process.env.WSOPCUA_PASSWORD }
            : undefined,
    });
    check(true, 'createSession');

    /* 读 ServerStatus.CurrentTime（ns=0;i=2258） */
    const serverTime = await session.readVariableValueP('ns=0;i=2258');
    check(serverTime.value?.value != null,
          'read ns=0;i=2258 (ServerStatus.CurrentTime)');

    /* 读 demo 模型变量（Speed，初值 12.5；NodeId 由环境变量指定） */
    const speed = await session.readVariableValueP(speedNodeId);
    check(speed.value?.value?.value != null, `read ${speedNodeId} (Speed)`);
    console.log(`  Speed = ${speed.value?.value?.value}`);
    check(typeof speed.value?.value?.value === 'number', 'Speed is Double');

    /* 写 Speed = 21.5 并读回 */
    const nodeId = coerceNodeId(speedNodeId);
    const writeStatus = await session.writeP(
        new WriteValue({
            nodeId,
            attributeId: AttributeIds.Value,
            value: new DataValue({
                value: new Variant({ value: 21.5, dataType: DataType.Double }),
            }),
        })
    );
    check(writeStatus.value === 0,
          `write ${speedNodeId} = 21.5 (value=${writeStatus.value})`);
    const readBack = await session.readVariableValueP(speedNodeId);
    check(readBack.value?.value?.value === 21.5,
          `read-back ${speedNodeId} = ${readBack.value?.value?.value}`);

    /* 浏览 Objects 文件夹（ns=0;i=85） */
    const browse = await session.browseP('ns=0;i=85');
    const refs = browse.results[0]?.references || [];
    check(refs.length > 0, `browse ObjectsFolder (${refs.length} references)`);
    for (const ref of refs.slice(0, 5))
        console.log(`  ${ref.browseName.name}: ${ref.nodeId.toString()}`);

    await session.closeP();
    check(true, 'closeSession');
} catch (err) {
    console.error('ERROR:', err.message || err);
    failures += 1;
}

try {
    await client.disconnectP();
} catch (err) {
    console.error('disconnect error:', err.message || err);
}

if (failures > 0) {
    console.error(`FAILED: ${failures} checks`);
    process.exit(1);
}
console.log('PASS vulcan websocket opcua client (wsopcua) end-to-end');
/* wsopcua 的 keepalive/定时器会让 Node 进程挂住，测试结束显式退出 */
process.exit(0);
