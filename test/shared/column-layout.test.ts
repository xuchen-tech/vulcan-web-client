import { describe, expect, it } from 'vitest'

import {
  MIN_ATTR,
  MIN_LEFT,
  MIN_LOG,
  MIN_MAIN,
  MIN_MID,
  MIN_REF,
  MIN_RIGHT,
  SPLITTER_PX,
  clampColumns,
  clampFirstPane,
} from '@/shared/column-layout'

describe('clampColumns', () => {
  it('keeps values within min widths', () => {
    const total = MIN_LEFT + MIN_MID + MIN_RIGHT + SPLITTER_PX * 2 + 400
    const result = clampColumns(80, 90, total)
    expect(result.leftPx).toBe(MIN_LEFT)
    expect(result.rightPx).toBe(MIN_RIGHT)
  })

  it('leaves room for Data Access when left is very wide', () => {
    const total = 900
    const result = clampColumns(800, 280, total)
    expect(result.leftPx + result.rightPx + MIN_MID).toBeLessThanOrEqual(
      total - SPLITTER_PX * 2,
    )
    expect(result.leftPx).toBeGreaterThanOrEqual(MIN_LEFT)
    expect(result.rightPx).toBeGreaterThanOrEqual(MIN_RIGHT)
  })
})

describe('clampFirstPane', () => {
  it('clamps Attributes height so References keep a minimum', () => {
    const total = 500
    expect(clampFirstPane(40, total, MIN_ATTR, MIN_REF)).toBe(MIN_ATTR)
    const tall = clampFirstPane(480, total, MIN_ATTR, MIN_REF)
    expect(tall).toBe(total - SPLITTER_PX - MIN_REF)
  })

  it('clamps Event Log height so the main workspace stays usable', () => {
    const total = 700
    expect(clampFirstPane(20, total, MIN_LOG, MIN_MAIN)).toBe(MIN_LOG)
    const tall = clampFirstPane(650, total, MIN_LOG, MIN_MAIN)
    expect(tall).toBe(total - SPLITTER_PX - MIN_MAIN)
    expect(tall).toBeGreaterThanOrEqual(MIN_LOG)
  })
})
