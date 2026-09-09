import { describe, expect, it } from 'vitest'

import {
  canSubscribeToEvents,
  eventNotifierToText,
  parseEventFieldMap,
  parseEventNotifierLevel,
  pickEventSummary,
  variantLikeToDisplay,
} from '@/opcua/event-parse'

describe('event-parse', () => {
  it('formats EventNotifier flags', () => {
    expect(eventNotifierToText(0)).toBe('0x0')
    expect(eventNotifierToText(1)).toBe('SubscribeToEvents (0x1)')
    expect(eventNotifierToText(3)).toBe(
      'SubscribeToEvents, HistoryRead (0x3)',
    )
  })

  it('detects SubscribeToEvents capability', () => {
    expect(canSubscribeToEvents(0)).toBe(false)
    expect(canSubscribeToEvents(1)).toBe(true)
    expect(canSubscribeToEvents(undefined)).toBe(false)
  })

  it('parses EventNotifier from attribute display text', () => {
    expect(parseEventNotifierLevel('SubscribeToEvents (0x1)')).toBe(1)
    expect(parseEventNotifierLevel('1')).toBe(1)
    expect(parseEventNotifierLevel('—')).toBeUndefined()
  })

  it('maps event field variants to display strings', () => {
    const fields = parseEventFieldMap(
      ['Time', 'Severity', 'Message'],
      [new Date('2026-09-09T08:00:00.000Z'), 500, 'Test alarm'],
    )
    expect(fields.Severity).toBe('500')
    expect(fields.Message).toBe('Test alarm')
    expect(fields.Time).toContain('2026')
  })

  it('builds event summary from field map', () => {
    const summary = pickEventSummary({
      Time: '2026-09-09 16:00:00',
      Severity: '500',
      Message: 'Over limit',
      SourceName: 'Drive1',
      EventType: 'i=2041',
    })
    expect(summary.message).toBe('Over limit')
    expect(summary.sourceName).toBe('Drive1')
  })

  it('handles nested variant-like values', () => {
    expect(variantLikeToDisplay({ value: 42 })).toBe('42')
    expect(variantLikeToDisplay(null)).toBe('—')
  })
})
