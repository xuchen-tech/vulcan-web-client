import { defineStore } from 'pinia'
import { ref } from 'vue'

export type LogLevel = 'info' | 'ok' | 'warn' | 'err'

export interface LogEntry {
  id: number
  time: Date
  level: LogLevel
  message: string
}

const MAX_ENTRIES = 500

export const useLogStore = defineStore('log', () => {
  const entries = ref<LogEntry[]>([])
  let nextId = 1

  function append(level: LogLevel, message: string): void {
    entries.value.push({
      id: nextId++,
      time: new Date(),
      level,
      message,
    })
    if (entries.value.length > MAX_ENTRIES) {
      entries.value.splice(0, entries.value.length - MAX_ENTRIES)
    }
  }

  function info(message: string): void {
    append('info', message)
  }

  function ok(message: string): void {
    append('ok', message)
  }

  function warn(message: string): void {
    append('warn', message)
  }

  function err(message: string): void {
    append('err', message)
  }

  function clear(): void {
    entries.value = []
  }

  return {
    entries,
    append,
    info,
    ok,
    warn,
    err,
    clear,
  }
})
