<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import type { LogLevel } from '@/stores/log'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const listEl = ref<HTMLElement | null>(null)

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour12: false })
}

function levelClass(level: LogLevel): string {
  return `level-${level}`
}

watch(
  () => log.entries.length,
  async () => {
    await nextTick()
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight
    }
  },
)
</script>

<template>
  <footer class="log-panel">
    <div class="log-header">
      <h2>Log</h2>
      <button type="button" class="clear-btn" @click="log.clear()">Clear</button>
    </div>
    <div ref="listEl" class="log-list">
      <p v-if="log.entries.length === 0" class="log-empty">暂无日志</p>
      <div
        v-for="entry in log.entries"
        :key="entry.id"
        class="log-line"
        :class="levelClass(entry.level)"
      >
        <span class="log-time">[{{ formatTime(entry.time) }}]</span>
        <span class="log-level">[{{ entry.level }}]</span>
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
  max-height: 8rem;
  min-height: 5rem;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.log-header h2 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8b949e;
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
