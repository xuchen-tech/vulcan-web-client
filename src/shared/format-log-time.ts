export function formatLogTime(date: Date, now: Date = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const ms = String(date.getMilliseconds()).padStart(3, '0')

  if (sameDay) {
    return `${time}.${ms}`
  }

  return `${date.toLocaleDateString()} ${time}.${ms}`
}
