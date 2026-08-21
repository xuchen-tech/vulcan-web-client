import { describe, expect, it } from 'vitest'

import { formatLogTime } from '@/shared/format-log-time'

describe('formatLogTime', () => {
  it('includes milliseconds for same-day entries', () => {
    const now = new Date('2026-08-21T15:07:45.123')
    const formatted = formatLogTime(now, now)

    expect(formatted).toMatch(/\.123$/)
  })

  it('includes date for older entries', () => {
    const now = new Date('2026-08-21T15:07:45.000')
    const earlier = new Date('2026-08-20T10:00:00.000')
    const formatted = formatLogTime(earlier, now)

    expect(formatted).toContain('2026')
    expect(formatted).toContain('.000')
  })
})
