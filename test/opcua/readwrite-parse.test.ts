import { describe, expect, it } from 'vitest'

import {
  extractDataTypeId,
  parseWriteInput,
} from '@/opcua/readwrite-parse'

describe('readwrite-parse', () => {
  it('extracts data type id from node id strings', () => {
    expect(extractDataTypeId('i=11')).toBe(11)
    expect(extractDataTypeId('ns=0;i=6')).toBe(6)
    expect(extractDataTypeId(undefined)).toBeUndefined()
  })

  it('infers boolean, integer, double, and string scalars', () => {
    expect(parseWriteInput('true')).toMatchObject({
      dataType: 1,
      arrayType: 0,
      value: true,
    })
    expect(parseWriteInput('42')).toMatchObject({
      dataType: 6,
      arrayType: 0,
      value: 42,
    })
    expect(parseWriteInput('3.14')).toMatchObject({
      dataType: 11,
      arrayType: 0,
      value: 3.14,
    })
    expect(parseWriteInput('hello')).toMatchObject({
      dataType: 12,
      arrayType: 0,
      value: 'hello',
    })
  })

  it('uses data type hint when provided', () => {
    expect(
      parseWriteInput('21', { dataTypeNodeId: 'i=11' }),
    ).toMatchObject({
      dataType: 11,
      value: 21,
    })
  })

  it('parses comma-separated arrays when value rank indicates array', () => {
    expect(
      parseWriteInput('1, 2, 3', { dataTypeNodeId: 'i=6', valueRank: 1 }),
    ).toMatchObject({
      dataType: 6,
      arrayType: 1,
      value: [1, 2, 3],
    })
  })

  it('rejects structure writes', () => {
    expect(() =>
      parseWriteInput('{}', { dataTypeNodeId: 'i=22' }),
    ).toThrow(/结构体/)
  })

  it('rejects empty input', () => {
    expect(() => parseWriteInput('   ')).toThrow(/不能为空/)
  })
})
