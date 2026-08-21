import { DataType, type DataValue, type Variant } from '@wsopcua/wsopcua'
import { NodeClass } from '@wsopcua/wsopcua/data-model'

import type { OpcNodeClass } from '@/opcua/types'

import { statusCodeToText } from './status'

export function nodeClassName(nodeClass: OpcNodeClass | NodeClass): string {
  switch (nodeClass) {
    case NodeClass.Object:
      return 'Object'
    case NodeClass.Variable:
      return 'Variable'
    case NodeClass.Method:
      return 'Method'
    case NodeClass.ObjectType:
      return 'ObjectType'
    case NodeClass.VariableType:
      return 'VariableType'
    case NodeClass.ReferenceType:
      return 'ReferenceType'
    case NodeClass.DataType:
      return 'DataType'
    case NodeClass.View:
      return 'View'
    default:
      return `Class(${nodeClass})`
  }
}

export function dateTimeToLocal(value: Date | undefined | null): string {
  if (!value || Number.isNaN(value.getTime())) {
    return '—'
  }
  return value.toLocaleString()
}

export function variantToDisplay(variant: Variant | undefined | null): string {
  if (!variant || variant.value === undefined || variant.value === null) {
    return '<null>'
  }

  const { value, dataType } = variant

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatScalar(item, dataType)).join(', ')}]`
  }

  return formatScalar(value, dataType)
}

function formatScalar(value: unknown, dataType: DataType): string {
  if (value === null || value === undefined) {
    return '<null>'
  }

  switch (dataType) {
    case DataType.Boolean:
      return String(value)
    case DataType.String:
      return String(value)
    case DataType.DateTime:
      return value instanceof Date
        ? dateTimeToLocal(value)
        : String(value)
    case DataType.ByteString:
      if (value instanceof Uint8Array) {
        return `ByteString[${value.length}]`
      }
      return String(value)
    case DataType.NodeId:
    case DataType.ExpandedNodeId:
      return hasToString(value) ? value.toString() : String(value)
    case DataType.QualifiedName:
      return formatQualifiedName(value)
    case DataType.LocalizedText:
      return formatLocalizedText(value)
    case DataType.Int64:
    case DataType.UInt64:
      return String(value)
    case DataType.ExtensionObject:
      return formatExtensionObject(value)
    default:
      if (typeof value === 'object' && value !== null && 'toString' in value) {
        const text = String(value)
        return text === '[object Object]' ? JSON.stringify(value) : text
      }
      return String(value)
  }
}

function formatQualifiedName(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'name' in value) {
    const name = (value as { name?: string }).name
    const ns = (value as { namespaceIndex?: number }).namespaceIndex
    if (name) {
      return ns != null && ns > 0 ? `${ns}:${name}` : name
    }
  }
  return hasToString(value) ? value.toString() : String(value)
}

function formatLocalizedText(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'text' in value) {
    const text = (value as { text?: string }).text
    if (text) {
      return text
    }
  }
  return hasToString(value) ? value.toString() : String(value)
}

function formatExtensionObject(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return String(value)
  }
  if ('body' in value) {
    return `ExtensionObject(${variantToDisplay((value as { body?: Variant }).body as Variant)})`
  }
  return hasToString(value) ? value.toString() : '[ExtensionObject]'
}

export function formatDataValue(dataValue: DataValue | undefined | null): {
  displayValue: string
  detail: string
} {
  if (!dataValue) {
    return { displayValue: '—', detail: '' }
  }

  const displayValue = dataValue.value
    ? variantToDisplay(dataValue.value)
    : '<null>'

  const dataTypeName = dataValue.value
    ? DataType[dataValue.value.dataType] ?? String(dataValue.value.dataType)
    : '—'

  const parts = [
    `DataType: ${dataTypeName}`,
    `SourceTs: ${dateTimeToLocal(dataValue.sourceTimestamp)}`,
    `ServerTs: ${dateTimeToLocal(dataValue.serverTimestamp)}`,
    `Status: ${statusCodeToText(dataValue.statusCode)}`,
  ]

  return {
    displayValue,
    detail: parts.join(' | '),
  }
}

export function accessLevelToText(level: number | undefined | null): string {
  if (level == null) {
    return '—'
  }
  const flags: string[] = []
  if (level & 0x01) flags.push('CurrentRead')
  if (level & 0x02) flags.push('CurrentWrite')
  if (level & 0x04) flags.push('HistoryRead')
  if (level & 0x08) flags.push('HistoryWrite')
  if (level & 0x10) flags.push('SemanticChange')
  if (level & 0x20) flags.push('StatusWrite')
  if (level & 0x40) flags.push('TimestampWrite')
  return flags.length > 0 ? `${flags.join(', ')} (0x${level.toString(16)})` : `0x${level.toString(16)}`
}

function hasToString(value: unknown): value is { toString(): string } {
  return typeof value === 'object' && value !== null && 'toString' in value
}
