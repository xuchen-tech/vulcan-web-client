import { describe, expect, it } from 'vitest'

import { methodInputControl } from '@/opcua/method-input'

describe('method-input', () => {
  it('uses typed controls for scalar primitives', () => {
    expect(methodInputControl('Boolean', -1)).toBe('boolean')
    expect(methodInputControl('Int32', -1)).toBe('number')
    expect(methodInputControl('Double', 0)).toBe('number')
    expect(methodInputControl('DateTime', -1)).toBe('datetime')
    expect(methodInputControl('String', -1)).toBe('text')
  })

  it('keeps arrays as text', () => {
    expect(methodInputControl('Boolean', 1)).toBe('text')
    expect(methodInputControl('Int32', 2)).toBe('text')
  })
})
