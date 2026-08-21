<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { formatLogTime } from '@/shared/format-log-time'
import {
  LOG_LEVEL_LABEL,
  type LogFilter,
  type LogLevel,
  useLogStore,
} from '@/stores/log'

const log = useLogStore()
const listEl = ref<HTMLElement | null>(null)

const filterOptions: { value: LogFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'info', label: 'INFO' },
  { value: 'ok', label: 'OK' },
  { value: 'warn', label: 'WARN' },
  { value: 'err', label: 'ERR' },
]

const summaryText = computed(() => {
  const total = log.entries.length
  const visible = log.filteredEntries.length
  if (log.filterLevel === 'all') {
    return `${total} 条`
  }
  return `${visible}/${total} 条`
})

function levelClass(level: LogLevel): string {
  return `level-${level}`
}

async function scrollToBottom(): Promise<void> {
  if (!log.autoScroll || !listEl.value) {
    return
  }
  await nextTick()
  listEl.value.scrollTop = listEl.value.scrollHeight
}

watch(
  () => [log.filteredEntries.length, log.autoScroll] as const,
  () => {
    void scrollToBottom()
  },
)
</script>

<template>
  <footer class="log-panel">
    <div class="log-header">
      <div class="log-title">
        <h2>Log</h2>
        <span class="log-count">{{ summaryText }}</span>
      </div>

      <div class="log-controls">
        <label class="control">
          <span>级别</span>
          <select v-model="log.filterLevel" class="control-select">
            <option
              v-for="option in filterOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="control checkbox">
          <input v-model="log.autoScroll" type="checkbox" />
          <span>自动滚动</span>
        </label>

        <button type="button" class="clear-btn" @click="log.clear()">
          Clear
        </button>
      </div>
    </div>

    <div ref="listEl" class="log-list">
      <p v-if="log.filteredEntries.length === 0" class="log-empty">
        {{ log.entries.length === 0 ? '暂无日志' : '当前筛选无匹配项' }}
      </p>
      <div
        v-for="entry in log.filteredEntries"
        :key="entry.id"
        class="log-line"
        :class="levelClass(entry.level)"
      >
        <span class="log-time">[{{ formatLogTime(entry.time) }}]</span>
        <span class="log-level">[{{ LOG_LEVEL_LABEL[entry.level] }}]</span>
        <span class="log-message">{{ entry.message }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1rem;
  background: #24292f;
  color: #c9d1d9;
  border-top: 1px solid #30363d;
  min-height: 6.5rem;
  max-height: 12rem;
}

.log-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.25rem;
}

.log-title {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
}

.log-header h2 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8b949e;
}

.log-count {
  font-size: 0.72rem;
  color: #6e7681;
}

.log-controls {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: #8b949e;
}

.control.checkbox {
  cursor: pointer;
  user-select: none;
}

.control-select {
  padding: 0.1rem 0.3rem;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: #21262d;
  color: #c9d1d9;
  font-size: 0.72rem;
}

.clear-btn {
  padding: 0.1rem 0.45rem;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: #21262d;
  color: #8b949e;
  font-size: 0.75rem;
  cursor: pointer;
}

.clear-btn:hover {
  color: #f0f6fc;
  border-color: #484f58;
}

.log-list {
  flex: 1;
  overflow: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  line-height: 1.45;
  min-height: 0;
}

.log-empty {
  margin: 0;
  color: #6e7681;
  font-style: italic;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-word;
}

.log-time,
.log-level {
  color: #8b949e;
}

.level-ok .log-message {
  color: #7ee787;
}

.level-err .log-message {
  color: #ffa198;
}

.level-warn .log-message {
  color: #e3b341;
}

.level-info .log-message {
  color: #c9d1d9;
}
</style>
