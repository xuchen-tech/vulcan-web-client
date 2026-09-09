/** 纯函数：HistoryRead 时间范围、分页与曲线点（无 @wsopcua 依赖，便于 Vitest） */

/** OPC UA DateTime 原点（1601-01-01），用于“全部历史”查询 */
export const OPCUA_DATETIME_MIN = new Date(Date.UTC(1601, 0, 1, 0, 0, 0))

export const DEFAULT_HISTORY_MINUTES = 15
export const DEFAULT_NUM_VALUES = 500
export const MAX_NUM_VALUES = 2000
export const MAX_HISTORY_PAGES = 8

export interface HistoryRange {
  startTime: Date
  endTime: Date
}

export interface SparklinePoint {
  x: number
  y: number
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function parseDateTimeLocal(text: string): Date {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('时间不能为空')
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`无效时间: ${text}`)
  }
  return parsed
}

export function defaultHistoryRange(
  now = new Date(),
  minutes = DEFAULT_HISTORY_MINUTES,
): HistoryRange {
  return {
    startTime: new Date(now.getTime() - minutes * 60_000),
    endTime: now,
  }
}

export function allHistoryRange(now = new Date()): HistoryRange {
  return {
    startTime: OPCUA_DATETIME_MIN,
    endTime: new Date(now.getTime() + 60_000),
  }
}

export function parseHistoryRange(
  startText: string,
  endText: string,
): HistoryRange {
  const startTime = parseDateTimeLocal(startText)
  const endTime = parseDateTimeLocal(endText)
  if (startTime.getTime() >= endTime.getTime()) {
    throw new Error('开始时间必须早于结束时间')
  }
  return { startTime, endTime }
}

export function parseNumValues(
  text: string,
  fallback = DEFAULT_NUM_VALUES,
): number {
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return Math.min(Math.floor(parsed), MAX_NUM_VALUES)
}

export function hasContinuationPoint(
  continuationPoint: Uint8Array | undefined | null,
): boolean {
  return !!continuationPoint && continuationPoint.length > 0
}

export function extractHistoryDataValues(historyData: unknown): unknown[] {
  if (!historyData || typeof historyData !== 'object') {
    return []
  }

  const obj = historyData as { dataValues?: unknown; body?: unknown }
  if (Array.isArray(obj.dataValues)) {
    return obj.dataValues
  }

  if (obj.body && typeof obj.body === 'object') {
    const nested = obj.body as { dataValues?: unknown }
    if (Array.isArray(nested.dataValues)) {
      return nested.dataValues
    }
  }

  return []
}

export function extractNumericValue(value: unknown): number | null {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'bigint') {
    const asNumber = Number(value)
    return Number.isFinite(asNumber) ? asNumber : null
  }
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    const asNumber = value[0] + value[1] * 0x1_0000_0000
    return Number.isFinite(asNumber) ? asNumber : null
  }
  return null
}

export function timestampMs(value: Date | undefined | null): number | null {
  if (!value || Number.isNaN(value.getTime())) {
    return null
  }
  return value.getTime()
}

export function isNoDataStatusText(text: string | undefined | null): boolean {
  if (!text) {
    return false
  }
  return /no data exists for the requested time range/i.test(text) ||
    text === 'BadNoData' ||
    text === 'GoodNoData' ||
    text === 'BadNoDataAvailable'
}

export function isNoDataPlaceholder(sample: {
  sourceTimestampMs: number | null
  numericValue: number | null
  displayValue: string
  isError: boolean
  statusCode: string
}): boolean {
  const noTimestamp = sample.sourceTimestampMs == null
  const noNumeric = sample.numericValue == null
  const emptyValue =
    !sample.displayValue ||
    sample.displayValue === '—' ||
    sample.displayValue === '<null>' ||
    isNoDataStatusText(sample.displayValue)
  return noTimestamp && noNumeric && (sample.isError || emptyValue || isNoDataStatusText(sample.statusCode))
}

export function sortHistoryNewestFirst<T extends { sourceTimestampMs: number | null }>(
  samples: T[],
): T[] {
  return [...samples].sort((a, b) => {
    if (a.sourceTimestampMs == null && b.sourceTimestampMs == null) {
      return 0
    }
    if (a.sourceTimestampMs == null) {
      return 1
    }
    if (b.sourceTimestampMs == null) {
      return -1
    }
    return b.sourceTimestampMs - a.sourceTimestampMs
  })
}

export function buildSparklinePoints(
  samples: Array<{ sourceTimestampMs: number | null; numericValue: number | null }>,
): SparklinePoint[] {
  const points: SparklinePoint[] = []
  for (const sample of samples) {
    if (sample.sourceTimestampMs == null || sample.numericValue == null) {
      continue
    }
    points.push({ x: sample.sourceTimestampMs, y: sample.numericValue })
  }
  points.sort((a, b) => a.x - b.x)
  return points
}

export function sparklinePolyline(
  points: SparklinePoint[],
  width: number,
  height: number,
  padding = 10,
): string {
  if (points.length === 0 || width <= 0 || height <= 0) {
    return ''
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const innerW = Math.max(width - padding * 2, 1)
  const innerH = Math.max(height - padding * 2, 1)

  const ordered = [...points].sort((a, b) => a.x - b.x)
  return ordered
    .map((point) => {
      const x = padding + ((point.x - minX) / spanX) * innerW
      const y = padding + (1 - (point.y - minY) / spanY) * innerH
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}
