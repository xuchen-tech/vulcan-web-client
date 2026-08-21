export interface LogSink {
  err(message: string): void
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  return String(err)
}

export function logActionError(
  sink: LogSink,
  context: string,
  err: unknown,
): string {
  const message = toErrorMessage(err)
  sink.err(`${context}: ${message}`)
  return message
}
