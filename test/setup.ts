/** Vitest 运行于 Node；@wsopcua/wsopcua 部分模块期望 browser 全局 */
;(globalThis as typeof globalThis & { window: typeof globalThis }).window =
  globalThis
