import { DataValue, StatusCodes, Variant } from '@wsopcua/wsopcua'
import { describe, expect, it } from 'vitest'

import { resolveDataValueStatus } from '@/opcua/status'

describe('resolveDataValueStatus', () => {
  it('treats missing status with value as Good', () => {
    const dataValue = new DataValue({
      value: new Variant({ dataType: 1, value: true }),
    })

    const resolved = resolveDataValueStatus(dataValue)

    expect(resolved.isError).toBe(false)
    expect(resolved.statusCode.name).toBe('Good')
  })

  it('returns BadNoData when value and status are missing', () => {
    const resolved = resolveDataValueStatus(new DataValue())

    expect(resolved.isError).toBe(true)
    expect(resolved.statusCode.name).toBe('BadNoData')
  })

  it('preserves explicit bad status', () => {
    const dataValue = new DataValue({
      statusCode: StatusCodes.BadNotReadable,
      value: new Variant({ dataType: 1, value: false }),
    })

    const resolved = resolveDataValueStatus(dataValue)

    expect(resolved.isError).toBe(true)
    expect(resolved.statusCode.name).toBe('BadNotReadable')
  })
})
