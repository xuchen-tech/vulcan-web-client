/** 纯函数：Method Argument 解析（便于 Vitest） */

import type { MethodArgumentDef } from './types'
import { extractDataTypeId } from './readwrite-parse'

const DATA_TYPE_NAMES: Record<number, string> = {
  1: 'Boolean',
  2: 'SByte',
  3: 'Byte',
  4: 'Int16',
  5: 'UInt16',
  6: 'Int32',
  7: 'UInt32',
  8: 'Int64',
  9: 'UInt64',
  10: 'Float',
  11: 'Double',
  12: 'String',
  13: 'DateTime',
  15: 'Guid',
  16: 'ByteString',
}

export interface RawArgumentLike {
  name?: string
  dataType?: { toString(): string } | string
  valueRank?: number
  arrayDimensions?: number[]
  description?: { text?: string } | string
}

export function dataTypeNodeIdToName(dataTypeNodeId: string): string {
  const id = extractDataTypeId(dataTypeNodeId)
  if (id == null) {
    return dataTypeNodeId
  }
  return DATA_TYPE_NAMES[id] ?? `i=${id}`
}

export function rawArgumentToDef(raw: RawArgumentLike): MethodArgumentDef | null {
  const name = raw.name?.trim()
  if (!name) {
    return null
  }

  const dataTypeNodeId =
    typeof raw.dataType === 'string'
      ? raw.dataType
      : raw.dataType?.toString() ?? '—'

  const description =
    typeof raw.description === 'string'
      ? raw.description
      : raw.description?.text?.trim() ?? ''

  return {
    name,
    dataTypeNodeId,
    dataTypeName: dataTypeNodeIdToName(dataTypeNodeId),
    valueRank: raw.valueRank ?? -1,
    arrayDimensions: raw.arrayDimensions ?? [],
    description,
  }
}

export function extensionObjectToArgument(raw: unknown): RawArgumentLike | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const withBody = raw as { body?: unknown }
  if (withBody.body && typeof withBody.body === 'object') {
    return withBody.body as RawArgumentLike
  }

  if ('name' in raw || 'Name' in raw) {
    const legacy = raw as Record<string, unknown>
    return {
      name: String(legacy.name ?? legacy.Name ?? ''),
      dataType: legacy.dataType as RawArgumentLike['dataType'],
      valueRank: Number(legacy.valueRank ?? legacy.ValueRank ?? -1),
      arrayDimensions: (legacy.arrayDimensions ?? legacy.ArrayDimensions) as
        | number[]
        | undefined,
      description: legacy.description as RawArgumentLike['description'],
    }
  }

  return null
}

export function parseArgumentItems(items: unknown[]): MethodArgumentDef[] {
  return items
    .map((item) => {
      const raw = extensionObjectToArgument(item)
      return raw ? rawArgumentToDef(raw) : null
    })
    .filter((item): item is MethodArgumentDef => item != null)
}
