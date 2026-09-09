import { describe, expect, it } from 'vitest'

import {
  OPCUA_DATETIME_MIN,
  allHistoryRange,
  buildSparklinePoints,
  defaultHistoryRange,
  extractHistoryDataValues,
  extractNumericValue,
  hasContinuationPoint,
  isNoDataPlaceholder,
  parseHistoryRange,
  parseNumValues,
  sortHistoryNewestFirst,
  sparklinePolyline,
  toDateTimeLocalValue,
} from '@/opcua/history-parse'

describe('history-parse', () => {
  it('formats and parses datetime-local values', () => {
    const date = new Date(2026, 8, 9, 16, 45, 12)
    const text = toDateTimeLocalValue(date)
    expect(text).toBe('2026-09-09T16:45:12')
    expect(parseHistoryRange(text, '2026-09-09T16:50:00').startTime.getTime()).toBe(
      date.getTime(),
    )
  })

  it('rejects inverted ranges', () => {
    expect(() =>
      parseHistoryRange('2026-09-09T17:00:00', '2026-09-09T16:00:00'),
    ).toThrow(/开始时间/)
  })

  it('clamps numValues and falls back on invalid input', () => {
    expect(parseNumValues('12')).toBe(12)
    expect(parseNumValues('99999')).toBe(2000)
    expect(parseNumValues('abc')).toBe(500)
    expect(parseNumValues('0')).toBe(500)
  })

  it('builds default and all-history ranges', () => {
    const now = new Date('2026-09-09T08:00:00.000Z')
    const recent = defaultHistoryRange(now, 15)
    expect(now.getTime() - recent.startTime.getTime()).toBe(15 * 60_000)
    const all = allHistoryRange(now)
    expect(all.startTime.getTime()).toBe(OPCUA_DATETIME_MIN.getTime())
    expect(all.endTime.getTime()).toBeGreaterThan(now.getTime())
  })

  it('extracts HistoryData values from nested ExtensionObject', () => {
    expect(extractHistoryDataValues({ dataValues: [1, 2] })).toEqual([1, 2])
    expect(
      extractHistoryDataValues({ body: { dataValues: ['a'] } }),
    ).toEqual(['a'])
    expect(extractHistoryDataValues(null)).toEqual([])
  })

  it('detects continuation points', () => {
    expect(hasContinuationPoint(undefined)).toBe(false)
    expect(hasContinuationPoint(new Uint8Array())).toBe(false)
    expect(hasContinuationPoint(new Uint8Array([1, 2]))).toBe(true)
  })

  it('extracts numeric samples for charting', () => {
    expect(extractNumericValue(true)).toBe(1)
    expect(extractNumericValue(false)).toBe(0)
    expect(extractNumericValue(42.5)).toBe(42.5)
    expect(extractNumericValue('ok')).toBeNull()
    expect(extractNumericValue([3, 0])).toBe(3)
  })

  it('builds sparkline polylines in chronological order', () => {
    const points = buildSparklinePoints([
      { sourceTimestampMs: 200, numericValue: 3 },
      { sourceTimestampMs: 100, numericValue: 1 },
      { sourceTimestampMs: null, numericValue: 9 },
    ])
    expect(points).toEqual([
      { x: 100, y: 1 },
      { x: 200, y: 3 },
    ])
    const path = sparklinePolyline(points, 100, 40, 0)
    expect(path).toContain('0.00,40.00')
    expect(path).toContain('100.00,0.00')
  })

  it('sorts raw samples newest first', () => {
    const sorted = sortHistoryNewestFirst([
      { sourceTimestampMs: 100, value: 'old' },
      { sourceTimestampMs: 300, value: 'new' },
      { sourceTimestampMs: null, value: 'none' },
      { sourceTimestampMs: 200, value: 'mid' },
    ])
    expect(sorted.map((item) => item.value)).toEqual(['new', 'mid', 'old', 'none'])
  })

  it('detects no-data placeholder rows', () => {
    expect(
      isNoDataPlaceholder({
        sourceTimestampMs: null,
        numericValue: null,
        displayValue:
          'No data exists for the requested time range or event filter.',
        isError: true,
        statusCode:
          'No data exists for the requested time range or event filter.',
      }),
    ).toBe(true)
    expect(
      isNoDataPlaceholder({
        sourceTimestampMs: 1,
        numericValue: 12,
        displayValue: '12',
        isError: false,
        statusCode: 'Good',
      }),
    ).toBe(false)
  })
})
