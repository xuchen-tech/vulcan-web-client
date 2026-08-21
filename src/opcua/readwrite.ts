import {
  AttributeIds,
  DataValue,
  Variant,
  VariantArrayType,
  WriteValue,
  coerceNodeId,
} from '@wsopcua/wsopcua'

import { opcuaClientService } from './client'
import { formatDataValue } from './format'
import {
  type ParseWriteOptions,
  parseWriteInput,
} from './readwrite-parse'
import { statusCodeToText, statusIsBad, resolveDataValueStatus } from './status'
import type { ValueReadResult, WriteValueResult } from './types'

export type { ParseWriteOptions } from './readwrite-parse'
export { extractDataTypeId, parseWriteInput } from './readwrite-parse'

export async function readValue(nodeId: string): Promise<ValueReadResult> {
  const session = opcuaClientService.getSession()
  const response = await session.readVariableValueP(nodeId)
  return dataValueToReadResult(nodeId, response.value)
}

export async function writeValue(
  nodeId: string,
  inputText: string,
  options: ParseWriteOptions = {},
): Promise<WriteValueResult> {
  const parsed = parseWriteInput(inputText, options)
  const session = opcuaClientService.getSession()

  const variant = new Variant({
    dataType: parsed.dataType,
    arrayType:
      parsed.arrayType === 1
        ? VariantArrayType.Array
        : VariantArrayType.Scalar,
    value: parsed.value,
  })

  const writeStatus = await session.writeP(
    new WriteValue({
      nodeId: coerceNodeId(nodeId),
      attributeId: AttributeIds.Value,
      value: new DataValue({
        value: variant,
      }),
    }),
  )

  const writeStatusText = statusCodeToText(writeStatus)
  const writeOk = !statusIsBad(writeStatus)

  const result: WriteValueResult = {
    nodeId,
    writtenValue: parsed.displayText,
    writeStatusCode: writeStatusText,
    writeOk,
  }

  if (writeOk) {
    result.readBack = await readValue(nodeId)
  }

  return result
}

function dataValueToReadResult(
  nodeId: string,
  dataValue: DataValue | undefined,
): ValueReadResult {
  const resolved = resolveDataValueStatus(dataValue)

  if (resolved.isError) {
    return {
      nodeId,
      displayValue: resolved.text,
      detail: '',
      statusCode: resolved.text,
      isError: true,
    }
  }

  const formatted = formatDataValue(dataValue)
  return {
    nodeId,
    displayValue: formatted.displayValue,
    detail: formatted.detail,
    statusCode: resolved.text,
    isError: false,
  }
}
