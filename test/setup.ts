/** Vitest 运行于 Node；@wsopcua/wsopcua 部分模块期望 browser 全局 */
import { webcrypto } from 'node:crypto'

;(globalThis as typeof globalThis & { window: typeof globalThis }).window =
  globalThis

if (!globalThis.crypto?.subtle) {
  globalThis.crypto = webcrypto as Crypto
}
