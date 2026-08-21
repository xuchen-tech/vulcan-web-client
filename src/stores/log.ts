import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type LogLevel = 'info' | 'ok' | 'warn' | 'err'

export type LogFilter = LogLevel | 'all'

export interface LogEntry {
  id: number
  time: Date
  level: LogLevel
  message: string
}

const MAX_ENTRIES = 500

export const LOG_LEVEL_LABEL: Record<LogLevel, string> = {
  info: 'INFO',
  ok: 'OK',
  warn: 'WARN',
  err: 'ERR',
}

export const useLogStore = defineStore('log', () => {
  const entries = ref<LogEntry[]>([])
  const filterLevel = ref<LogFilter>('all')
  const autoScroll = ref(true)
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

  const filteredEntries = computed(() => {
    if (filterLevel.value === 'all') {
      return entries.value
    }
    return entries.value.filter((entry) => entry.level === filterLevel.value)
  })

  const levelCounts = computed(() => {
    const counts: Record<LogLevel, number> = {
      info: 0,
      ok: 0,
      warn: 0,
      err: 0,
    }
    for (const entry of entries.value) {
      counts[entry.level] += 1
    }
    return counts
  })

  return {
    entries,
    filterLevel,
    autoScroll,
    filteredEntries,
    levelCounts,
    append,
    info,
    ok,
    warn,
    err,
    clear,
  }
})
