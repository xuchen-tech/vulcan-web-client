/** 纯函数：EventNotifier 解析与 EventFilter 字段格式化（便于 Vitest） */

import type { Variant } from '@wsopcua/wsopcua'

export const DEFAULT_EVENT_FIELD_NAMES = [
  'Time',
  'Severity',
  'Message',
  'SourceName',
  'EventType',
] as const

export type DefaultEventFieldName = (typeof DEFAULT_EVENT_FIELD_NAMES)[number]

/** 标准 Server 对象，常用作事件源入口 */
export const DEFAULT_EVENT_SOURCE_NODE_ID = 'i=2253'

export function eventNotifierToText(level: number | undefined | null): string {
  if (level == null) {
    return '—'
  }
  const flags: string[] = []
  if (level & 0x01) flags.push('SubscribeToEvents')
  if (level & 0x02) flags.push('HistoryRead')
  if (level & 0x04) flags.push('HistoryWrite')
  return flags.length > 0
    ? `${flags.join(', ')} (0x${level.toString(16)})`
    : `0x${level.toString(16)}`
}

export function canSubscribeToEvents(
  eventNotifier: number | undefined | null,
): boolean {
  return eventNotifier != null && (eventNotifier & 0x01) !== 0
}

export function parseEventNotifierLevel(
  text: string | undefined,
): number | undefined {
  if (text == null || text === '—' || text === '<null>') {
    return undefined
  }
  const direct = Number(text)
  if (Number.isFinite(direct)) {
    return direct
  }
  const hex = /\(0x([0-9a-f]+)\)/i.exec(text)
  if (hex) {
    return parseInt(hex[1], 16)
  }
  return undefined
}

export function variantLikeToDisplay(value: unknown): string {
  if (value == null) {
    return '—'
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '—' : value.toLocaleString()
  }
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return variantLikeToDisplay((value as Variant).value)
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const text = String(value)
    return text === '[object Object]' ? JSON.stringify(value) : text
  }
  return String(value)
}

export function parseEventFieldMap(
  fieldNames: readonly string[],
  eventFields: unknown[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (let index = 0; index < fieldNames.length; index++) {
    result[fieldNames[index]] = variantLikeToDisplay(eventFields[index])
  }
  return result
}

export function pickEventSummary(
  fields: Record<string, string>,
): {
  time: string
  severity: string
  message: string
  sourceName: string
  eventType: string
} {
  return {
    time: fields.Time ?? '—',
    severity: fields.Severity ?? '—',
    message: fields.Message ?? '—',
    sourceName: fields.SourceName ?? '—',
    eventType: fields.EventType ?? '—',
  }
}
