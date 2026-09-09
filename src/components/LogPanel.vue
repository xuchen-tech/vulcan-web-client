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
        <span class="panel-mark" />
        <h2>Event Log</h2>
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
        <span class="log-time">{{ formatLogTime(entry.time) }}</span>
        <span class="log-level">{{ LOG_LEVEL_LABEL[entry.level] }}</span>
        <span class="log-message">{{ entry.message }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  padding: 0.45rem 0.75rem 0.5rem;
  background: var(--bg-header);
  color: var(--text);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.log-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.3rem;
}

.log-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.log-header h2 {
  margin: 0;
}

.log-count {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-dim);
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
  font-size: 0.68rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.control.checkbox {
  cursor: pointer;
  user-select: none;
}

.control-select {
  padding: 0.12rem 0.3rem;
  font-size: 0.7rem;
}

.clear-btn {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}

.log-list {
  flex: 1;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.45;
  min-height: 0;
  background: var(--bg-inset);
  border: 1px solid var(--border);
  padding: 0.25rem 0.4rem;
}

.log-empty {
  margin: 0;
  color: var(--text-dim);
  font-style: italic;
}

.log-line {
  display: grid;
  grid-template-columns: 5.4rem 3.2rem 1fr;
  gap: 0.45rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-time {
  color: var(--text-dim);
}

.log-level {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.level-ok .log-level,
.level-ok .log-message {
  color: var(--good);
}

.level-err .log-level,
.level-err .log-message {
  color: var(--bad);
}

.level-warn .log-level,
.level-warn .log-message {
  color: var(--warn);
}

.level-info .log-level {
  color: var(--info);
}

.level-info .log-message {
  color: var(--text);
}
</style>
