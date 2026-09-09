import { describe, expect, it } from 'vitest'

import { formatPlainObject } from '@/opcua/format-object'

describe('format-object', () => {
  it('dumps enumerable fields and skips encode/decode', () => {
    expect(
      formatPlainObject({
        name: 'Speed',
        value: 12,
        encode: () => {},
      }),
    ).toBe('{ name: Speed, value: 12 }')
  })

  it('formats nested objects and arrays', () => {
    expect(formatPlainObject({ inner: { flag: true }, items: [1, 2] })).toBe(
      '{ inner: { flag: true }, items: [1, 2] }',
    )
  })
})
