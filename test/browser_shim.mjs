/* Node 端浏览器全局 shim：让 @wsopcua/wsopcua（纯浏览器库）可在 Node 中运行
 * 做自动化测试。浏览器内由真实 window/WebSocket 提供，无需此文件。 */
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import WS from 'ws';

/* TLS 信任：默认不校验（本地自签名证书测试；浏览器访问自签名 wss 时
 * 同样需要手动信任证书）。设置 WSOPCUA_CA_FILE 时使用指定 CA 校验。 */
function tlsOptions() {
    const caFile = process.env.WSOPCUA_CA_FILE;
    if (caFile) {
        return { ca: readFileSync(caFile), rejectUnauthorized: true };
    }
    return { rejectUnauthorized: false };
}

/* wsopcua 按浏览器 WebSocket API 使用：onopen/onmessage/onclose 属性、
 * addEventListener('error')、binaryType='arraybuffer'、实例 OPEN 常量。
 * Node 的 ws 库仅覆盖其中一部分，这里补齐浏览器语义。 */
class BrowserWebSocketShim {
    constructor(url, protocol) {
        this._ws = new WS(url, protocol ? [protocol] : undefined, tlsOptions());
        this.binaryType = 'arraybuffer';
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;

        this._ws.on('open', () => this.onopen && this.onopen({}));
        this._ws.on('message', (data, isBinary) => {
            if (!this.onmessage)
                return;
            const evt = isBinary ? { data: toArrayBuffer(data) } : { data: data.toString() };
            this.onmessage(evt);
        });
        this._ws.on('close', (code, reason) =>
            this.onclose && this.onclose({ code, reason: reason.toString() }));
        this._ws.on('error', (err) => {
            if (this.onerror)
                this.onerror(err);
        });
    }

    get readyState() {
        return this._ws.readyState;
    }

    get OPEN() {
        return WS.OPEN;
    }

    get CONNECTING() {
        return WS.CONNECTING;
    }

    get CLOSING() {
        return WS.CLOSING;
    }

    get CLOSED() {
        return WS.CLOSED;
    }

    send(data) {
        this._ws.send(data);
    }

    close(code, reason) {
        this._ws.close(code, reason);
    }

    addEventListener(type, listener) {
        this._ws.on(type, listener);
    }
}

function toArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/* 浏览器全局（Node 16 无 window/WebSocket） */
globalThis.window = {
    setImmediate,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    atob,
    crypto: webcrypto,
    msCrypto: webcrypto,
    location: { hostname: process.env.WSOPCUA_HOSTNAME || 'localhost' },
    addEventListener() {},
};
/* wsopcua 部分模块直接引用全局 crypto（浏览器全局）；Node 16 用 webcrypto */
globalThis.crypto = webcrypto;
globalThis.CryptoKey = webcrypto.CryptoKey;
globalThis.WebSocket = BrowserWebSocketShim;
