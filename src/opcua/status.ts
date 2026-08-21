import type { StatusCode } from '@wsopcua/wsopcua'

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
