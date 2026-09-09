import { describe, expect, it } from 'vitest'

import {
  nodeIdsEqual,
  normalizeNodeId,
  pickPreferredParentNodeId,
} from '@/opcua/browse-mode'

describe('browse-mode', () => {
  it('normalizes ns=0 numeric node ids', () => {
    expect(normalizeNodeId('ns=0;i=84')).toBe('i=84')
    expect(normalizeNodeId('i=84')).toBe('i=84')
    expect(nodeIdsEqual('i=85', 'ns=0;i=85')).toBe(true)
  })

  it('prefers Objects then Root when picking a parent', () => {
    expect(
      pickPreferredParentNodeId(['ns=3;s=PLC', 'ns=0;i=85', 'i=84']),
    ).toBe('ns=0;i=85')
    expect(pickPreferredParentNodeId(['i=84'])).toBe('i=84')
    expect(pickPreferredParentNodeId([])).toBeNull()
  })
})
