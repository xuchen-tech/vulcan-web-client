/* Node 端浏览器全局 shim：让 @wsopcua/wsopcua 可在 Node 中跑端到端冒烟测试。 */
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import WS from 'ws'

function tlsOptions() {
  const caFile = process.env.WSOPCUA_CA_FILE
  if (caFile) {
    return { ca: readFileSync(caFile), rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}

class BrowserWebSocketShim {
  constructor(url, protocol) {
    this._ws = new WS(url, protocol ? [protocol] : undefined, tlsOptions())
    this.binaryType = 'arraybuffer'
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null

    this._ws.on('open', () => this.onopen && this.onopen({}))
    this._ws.on('message', (data, isBinary) => {
      if (!this.onmessage) {
        return
      }
      const evt = isBinary
        ? { data: toArrayBuffer(data) }
        : { data: data.toString() }
      this.onmessage(evt)
    })
    this._ws.on('close', (code, reason) => {
      this.onclose && this.onclose({ code, reason: reason.toString() })
    })
    this._ws.on('error', (err) => {
      if (this.onerror) {
        this.onerror(err)
      }
    })
  }

  get readyState() {
    return this._ws.readyState
  }

  get OPEN() {
    return WS.OPEN
  }

  get CONNECTING() {
    return WS.CONNECTING
  }

  get CLOSING() {
    return WS.CLOSING
  }

  get CLOSED() {
    return WS.CLOSED
  }

  send(data) {
    this._ws.send(data)
  }

  close(code, reason) {
    this._ws.close(code, reason)
  }

  addEventListener(type, listener) {
    this._ws.on(type, listener)
  }
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
}

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
}
globalThis.crypto = webcrypto
globalThis.CryptoKey = webcrypto.CryptoKey
globalThis.WebSocket = BrowserWebSocketShim
