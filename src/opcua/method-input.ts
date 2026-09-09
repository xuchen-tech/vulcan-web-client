/** 纯函数：方法参数输入控件类型（便于 Vitest） */

export type MethodInputControl = 'boolean' | 'number' | 'datetime' | 'text'

const NUMBER_TYPES = new Set([
  'SByte',
  'Byte',
  'Int16',
  'UInt16',
  'Int32',
  'UInt32',
  'Float',
  'Double',
])

export function methodInputControl(
  dataTypeName: string,
  valueRank: number,
): MethodInputControl {
  if (valueRank > 0) {
    return 'text'
  }
  if (dataTypeName === 'Boolean') {
    return 'boolean'
  }
  if (dataTypeName === 'DateTime') {
    return 'datetime'
  }
  if (NUMBER_TYPES.has(dataTypeName)) {
    return 'number'
  }
  return 'text'
}
