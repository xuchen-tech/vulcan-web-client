import { StatusCodes, type DataValue, type StatusCode } from '@wsopcua/wsopcua'

export function statusIsBad(statusCode: StatusCode): boolean {
  return (statusCode.value & 0x80000000) !== 0
}

export function statusCodeToText(
  statusCode: StatusCode | undefined | null,
): string {
  if (!statusCode) {
    return '—'
  }
  return statusCode.description || statusCode.name || statusCode.toString()
}

export interface ResolvedDataValueStatus {
  statusCode: StatusCode
  text: string
  isError: boolean
}

/** OPC UA DataValue：未编码 StatusCode 且含 Value 时默认为 Good。 */
export function resolveDataValueStatus(
  dataValue: DataValue | undefined | null,
): ResolvedDataValueStatus {
  if (!dataValue) {
    return {
      statusCode: StatusCodes.BadNoData,
      text: statusCodeToText(StatusCodes.BadNoData),
      isError: true,
    }
  }

  if (dataValue.statusCode != null) {
    return {
      statusCode: dataValue.statusCode,
      text: statusCodeToText(dataValue.statusCode),
      isError: statusIsBad(dataValue.statusCode),
    }
  }

  if (dataValue.value != null) {
    return {
      statusCode: StatusCodes.Good,
      text: statusCodeToText(StatusCodes.Good),
      isError: false,
    }
  }

  return {
    statusCode: StatusCodes.BadNoData,
    text: statusCodeToText(StatusCodes.BadNoData),
    isError: true,
  }
}
