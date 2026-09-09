/** 纯函数：ExtensionObject / 普通对象字段展示（便于 Vitest） */

const SKIP_KEYS = new Set([
  'encode',
  'decode',
  'toJSON',
  'fromJSON',
  'clone',
  'schema',
  'dataType',
  'encodingDefaultBinary',
  'encodingDefaultXml',
  'encodingDefaultJson',
])

export function formatPlainObject(value: unknown, depth = 0): string {
  if (value == null) {
    return '<null>'
  }
  if (typeof value !== 'object') {
    return String(value)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '—' : value.toISOString()
  }
  if (Array.isArray(value)) {
    if (depth > 3) {
      return `[${value.length} items]`
    }
    return `[${value.map((item) => formatPlainObject(item, depth + 1)).join(', ')}]`
  }
  if (depth > 4) {
    return '{…}'
  }

  const entries: string[] = []
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (SKIP_KEYS.has(key) || typeof field === 'function') {
      continue
    }
    entries.push(`${key}: ${formatPlainObject(field, depth + 1)}`)
  }

  if (entries.length === 0) {
    return ''
  }
  return `{ ${entries.join(', ')} }`
}
