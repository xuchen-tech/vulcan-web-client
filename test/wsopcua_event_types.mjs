/**
 * Node e2e：@wsopcua/wsopcua 主入口未导出 EventFilter，经 CJS generated 子路径加载。
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const generatedDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../node_modules/@wsopcua/wsopcua/_cjs/generated',
)

export const EventFilter = require(join(generatedDir, 'EventFilter.js')).EventFilter
export const ContentFilter = require(join(generatedDir, 'ContentFilter.js')).ContentFilter
export const QualifiedName = require(join(generatedDir, 'QualifiedName.js')).QualifiedName
export const SimpleAttributeOperand = require(
  join(generatedDir, 'SimpleAttributeOperand.js'),
).SimpleAttributeOperand
