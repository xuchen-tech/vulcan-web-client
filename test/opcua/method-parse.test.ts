import { describe, expect, it } from 'vitest'

import {
  dataTypeNodeIdToName,
  parseArgumentItems,
  rawArgumentToDef,
} from '@/opcua/method-parse'

describe('method-parse', () => {
  it('maps standard DataType node id to name', () => {
    expect(dataTypeNodeIdToName('i=11')).toBe('Double')
    expect(dataTypeNodeIdToName('i=1')).toBe('Boolean')
  })

  it('converts raw argument metadata', () => {
    const def = rawArgumentToDef({
      name: 'Input1',
      dataType: 'i=6',
      valueRank: -1,
      description: { text: 'counter' },
    })

    expect(def).toEqual({
      name: 'Input1',
      dataTypeNodeId: 'i=6',
      dataTypeName: 'Int32',
      valueRank: -1,
      arrayDimensions: [],
      description: 'counter',
    })
  })

  it('extracts Argument from ExtensionObject body', () => {
    const items = parseArgumentItems([
      {
        body: {
          name: 'Output1',
          dataType: 'i=12',
          valueRank: 0,
        },
      },
    ])

    expect(items).toHaveLength(1)
    expect(items[0]?.name).toBe('Output1')
  })
})
