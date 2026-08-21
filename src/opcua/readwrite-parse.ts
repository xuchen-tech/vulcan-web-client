/** 纯函数：写值输入解析（无 @wsopcua 依赖，便于 Vitest） */

export interface ParseWriteOptions {
  /** DataType 属性读回的 NodeId，如 i=11、ns=0;i=6 */
  dataTypeNodeId?: string
  /** ValueRank 属性（0=标量，>0=数组维数，-1=任意） */
  valueRank?: number
}

export interface ParsedWriteInput {
  /** 与 @wsopcua/wsopcua DataType 枚举一致的数值 */
  dataType: number
  arrayType: 0 | 1
  value: unknown
  /** 回显用 */
  displayText: string
}

const STRUCTURE_DATA_TYPE_ID = 22

export function extractDataTypeId(dataTypeNodeId: string | undefined): number | undefined {
  if (!dataTypeNodeId?.trim()) {
    return undefined
  }
  const match = dataTypeNodeId.match(/i=(\d+)/)
  if (!match) {
    return undefined
  }
  return Number(match[1])
}

export function parseWriteInput(
  text: string,
  options: ParseWriteOptions = {},
): ParsedWriteInput {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('写入值不能为空')
  }

  const dataTypeId = extractDataTypeId(options.dataTypeNodeId)
  if (dataTypeId === STRUCTURE_DATA_TYPE_ID) {
    throw new Error('结构体写入不在首版支持范围内')
  }

  const asArray = shouldParseAsArray(trimmed, options.valueRank)
  if (asArray) {
    const parts = trimmed.split(',').map((part) => part.trim())
    if (parts.some((part) => part.length === 0)) {
      throw new Error('数组元素不能为空（逗号分隔）')
    }
    const items = parts.map((part) => parseScalar(part, dataTypeId))
    const elementType = items[0]?.dataType ?? inferScalar(trimmed).dataType
    return {
      dataType: elementType,
      arrayType: 1,
      value: items.map((item) => item.value),
      displayText: trimmed,
    }
  }

  const scalar = parseScalar(trimmed, dataTypeId)
  return {
    dataType: scalar.dataType,
    arrayType: 0,
    value: scalar.value,
    displayText: trimmed,
  }
}

function shouldParseAsArray(text: string, valueRank: number | undefined): boolean {
  if (!text.includes(',')) {
    return false
  }
  if (valueRank == null) {
    return true
  }
  if (valueRank > 0) {
    return true
  }
  if (valueRank === -1 || valueRank === -2) {
    return true
  }
  return false
}

function parseScalar(
  text: string,
  dataTypeId: number | undefined,
): { dataType: number; value: unknown } {
  if (dataTypeId != null) {
    return coerceScalar(text, dataTypeId)
  }
  return inferScalar(text)
}

function inferScalar(text: string): { dataType: number; value: unknown } {
  const lower = text.toLowerCase()
  if (lower === 'true' || lower === 'false') {
    return { dataType: 1, value: lower === 'true' }
  }
  if (/^-?\d+$/.test(text)) {
    const n = Number(text)
    if (Number.isSafeInteger(n)) {
      return { dataType: 6, value: n }
    }
    return { dataType: 8, value: BigInt(text) }
  }
  if (/^-?(?:\d+\.\d+|\d+\.|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    return { dataType: 11, value: Number(text) }
  }
  return { dataType: 12, value: text }
}

/** DataTypeIds 与 DataType 枚举在前 25 项对齐 */
function coerceScalar(
  text: string,
  dataTypeId: number,
): { dataType: number; value: unknown } {
  switch (dataTypeId) {
    case 1:
      return coerceBoolean(text)
    case 2:
      return { dataType: 2, value: parseInt8(text) }
    case 3:
      return { dataType: 3, value: parseUInt8(text) }
    case 4:
      return { dataType: 4, value: parseInt16(text) }
    case 5:
      return { dataType: 5, value: parseUInt16(text) }
    case 6:
      return { dataType: 6, value: parseInt32(text) }
    case 7:
      return { dataType: 7, value: parseUInt32(text) }
    case 8:
      return { dataType: 8, value: BigInt(text) }
    case 9:
      return { dataType: 9, value: BigInt(text) }
    case 10:
      return { dataType: 10, value: parseFloat(text) }
    case 11:
      return { dataType: 11, value: Number(text) }
    case 12:
      return { dataType: 12, value: text }
    default:
      return inferScalar(text)
  }
}

function coerceBoolean(text: string): { dataType: number; value: unknown } {
  const lower = text.toLowerCase()
  if (lower === 'true' || lower === '1') {
    return { dataType: 1, value: true }
  }
  if (lower === 'false' || lower === '0') {
    return { dataType: 1, value: false }
  }
  throw new Error(`无法解析为 Boolean: ${text}`)
}

function parseInt8(text: string): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < -128 || n > 127) {
    throw new Error(`无法解析为 SByte: ${text}`)
  }
  return n
}

function parseUInt8(text: string): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < 0 || n > 255) {
    throw new Error(`无法解析为 Byte: ${text}`)
  }
  return n
}

function parseInt16(text: string): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < -32768 || n > 32767) {
    throw new Error(`无法解析为 Int16: ${text}`)
  }
  return n
}

function parseUInt16(text: string): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(`无法解析为 UInt16: ${text}`)
  }
  return n
}

function parseInt32(text: string): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) {
    throw new Error(`无法解析为 Int32: ${text}`)
  }
  return n
}

function parseUInt32(text: string): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < 0 || n > 4294967295) {
    throw new Error(`无法解析为 UInt32: ${text}`)
  }
  return n
}
