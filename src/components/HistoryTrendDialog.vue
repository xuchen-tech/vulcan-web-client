<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { readHistoryRaw } from '@/opcua/history'
import {
  DEFAULT_NUM_VALUES,
  allHistoryRange,
  defaultHistoryRange,
  parseHistoryRange,
  parseNumValues,
  sparklinePolyline,
  toDateTimeLocalValue,
} from '@/opcua/history-parse'
import type { HistoryReadOutcome } from '@/opcua/types'
import { logActionError } from '@/shared/error-message'
import { useLogStore } from '@/stores/log'

const props = defineProps<{
  visible: boolean
  nodeId: string
  nodeLabel?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const CHART_WIDTH = 640
const CHART_HEIGHT = 160

const startText = ref('')
const endText = ref('')
const numValuesText = ref(String(DEFAULT_NUM_VALUES))
const busy = ref(false)
const error = ref<string | null>(null)
const outcome = ref<HistoryReadOutcome | null>(null)

const chartPoints = computed(() => {
  const samples = outcome.value?.samples ?? []
  return samples
    .filter(
      (sample) =>
        sample.sourceTimestampMs != null && sample.numericValue != null,
    )
    .map((sample) => ({
      x: sample.sourceTimestampMs as number,
      y: sample.numericValue as number,
    }))
})

const polyline = computed(() =>
  sparklinePolyline(chartPoints.value, CHART_WIDTH, CHART_HEIGHT),
)

const yExtent = computed(() => {
  if (chartPoints.value.length === 0) {
    return null
  }
  const values = chartPoints.value.map((point) => point.y)
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
})

function applyRange(range: { startTime: Date; endTime: Date }): void {
  startText.value = toDateTimeLocalValue(range.startTime)
  endText.value = toDateTimeLocalValue(range.endTime)
}

watch(
  () => [props.visible, props.nodeId] as const,
  ([visible, nodeId]) => {
    if (visible && nodeId) {
      applyRange(defaultHistoryRange())
      numValuesText.value = String(DEFAULT_NUM_VALUES)
      outcome.value = null
      error.value = null
      void loadHistory()
    }
  },
  { immediate: true },
)

async function loadHistory(): Promise<void> {
  if (!props.nodeId) {
    return
  }

  const log = useLogStore()
  busy.value = true
  error.value = null

  try {
    const range = parseHistoryRange(startText.value, endText.value)
    const result = await readHistoryRaw({
      nodeId: props.nodeId,
      startTime: range.startTime,
      endTime: range.endTime,
      numValuesPerNode: parseNumValues(numValuesText.value),
    })
    outcome.value = result
    if (result.isError) {
      error.value = result.statusCode
      log.err(`HistoryRead ${props.nodeId}: ${result.statusCode}`)
      return
    }

    const extra = result.truncated ? '（已达分页上限，结果可能不完整）' : ''
    log.ok(
      `HistoryRead ${props.nodeId}: ${result.samples.length} 条 ${result.statusCode}${extra}`,
    )
  } catch (err) {
    error.value = logActionError(log, `HistoryRead 失败 (${props.nodeId})`, err)
    outcome.value = null
  } finally {
    busy.value = false
  }
}

function onPreset(minutes: number): void {
  applyRange(defaultHistoryRange(new Date(), minutes))
  void loadHistory()
}

function onAllHistory(): void {
  applyRange(allHistoryRange())
  void loadHistory()
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget && !busy.value) {
    emit('close')
  }
}

function onCancel(): void {
  if (!busy.value) {
    emit('close')
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="dialog-backdrop"
    role="presentation"
    @click="onBackdropClick"
  >
    <div class="dialog" role="dialog" aria-labelledby="history-title">
      <header class="dialog-header">
        <h3 id="history-title">History Trend</h3>
        <button type="button" class="btn-close" aria-label="关闭" @click="onCancel">
          ×
        </button>
      </header>

      <p class="method-name">{{ nodeLabel || nodeId }}</p>
      <p class="node-id">{{ nodeId }}</p>

      <form class="toolbar" @submit.prevent="loadHistory">
        <label class="field">
          <span class="field-label">开始</span>
          <input v-model="startText" class="field-input" type="datetime-local" step="1" />
        </label>
        <label class="field">
          <span class="field-label">结束</span>
          <input v-model="endText" class="field-input" type="datetime-local" step="1" />
        </label>
        <label class="field field-narrow">
          <span class="field-label">条数</span>
          <input v-model="numValuesText" class="field-input" type="number" min="1" max="2000" />
        </label>
        <div class="toolbar-actions">
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="onPreset(5)">
            5 分钟
          </button>
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="onPreset(15)">
            15 分钟
          </button>
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="onPreset(60)">
            1 小时
          </button>
          <button type="button" class="btn btn-secondary" :disabled="busy" @click="onAllHistory">
            全部
          </button>
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ busy ? '读取中…' : 'HistoryRead' }}
          </button>
        </div>
      </form>

      <p v-if="error" class="panel-error">{{ error }}</p>

      <template v-else-if="outcome">
        <p class="result-meta">
          {{ outcome.samples.length }} 条 · {{ outcome.statusCode }}
          <span v-if="outcome.truncated"> · 已截断</span>
        </p>

        <section v-if="polyline" class="chart-section">
          <h4>曲线</h4>
          <svg
            class="chart"
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            role="img"
            aria-label="历史值曲线"
          >
            <polyline
              :points="polyline"
              fill="none"
              stroke="var(--cyan)"
              stroke-width="2"
            />
          </svg>
          <p v-if="yExtent" class="chart-extent">
            min {{ yExtent.min }} · max {{ yExtent.max }}
          </p>
        </section>
        <p v-else-if="outcome.samples.length === 0" class="panel-hint">
          当前区间无历史数据。可点「全部」或扩大起止时间后再读。
        </p>
        <p v-else class="panel-hint">当前区间无可绘制的标量数值（仍可查看下表）。</p>

        <section v-if="outcome.samples.length > 0" class="table-section">
          <h4>原始值</h4>
          <div class="table-wrap">
            <table class="history-table">
              <thead>
                <tr>
                  <th>SourceTs</th>
                  <th>Value</th>
                  <th>ServerTs</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(sample, index) in outcome.samples"
                  :key="`${sample.sourceTimestampMs ?? index}`"
                  :class="{ 'row-bad': sample.isError }"
                >
                  <td class="mono">{{ sample.sourceTimestamp }}</td>
                  <td class="value">{{ sample.displayValue }}</td>
                  <td class="mono muted">{{ sample.serverTimestamp }}</td>
                  <td class="mono muted">{{ sample.statusCode }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <p v-else-if="busy" class="panel-hint">正在 HistoryRead…</p>

      <footer class="dialog-footer">
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="onCancel">
          关闭
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 8, 10, 0.72);
  padding: 1rem;
}

.dialog {
  width: min(56rem, 100%);
  max-height: min(92vh, 48rem);
  overflow: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border-accent);
  border-radius: var(--radius);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  padding: 0.9rem 1rem 0.85rem;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

.dialog-header h3 {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.btn-close {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: var(--text-muted);
}

.method-name {
  margin: 0 0 0.25rem;
  font-weight: 650;
  font-size: 0.9rem;
}

.node-id {
  margin: 0 0 0.65rem;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--cyan);
  word-break: break-all;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.7rem;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-narrow {
  width: 6.5rem;
}

.field-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-input {
  padding: 0.32rem 0.45rem;
  font-size: 0.78rem;
  font-family: var(--font-mono);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.panel-hint {
  margin: 0.7rem 0 0;
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.75rem;
}

.panel-error {
  margin: 0.7rem 0 0;
  color: var(--bad);
  font-size: 0.8rem;
}

.result-meta {
  margin: 0.7rem 0 0.35rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.chart-section,
.table-section {
  margin-top: 0.7rem;
}

.chart-section h4,
.table-section h4 {
  margin: 0 0 0.4rem;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}

.chart {
  width: 100%;
  height: 9rem;
  background: var(--bg-inset);
  border: 1px solid var(--border);
}

.chart-extent {
  margin: 0.3rem 0 0;
  font-size: 0.68rem;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.table-wrap {
  max-height: 16rem;
  overflow: auto;
  border: 1px solid var(--border);
  background: var(--bg-inset);
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.history-table th,
.history-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.28rem 0.4rem;
  text-align: left;
}

.history-table th {
  position: sticky;
  top: 0;
  background: var(--bg-table-head);
  color: var(--accent);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.value {
  font-family: var(--font-mono);
  color: var(--cyan);
}

.mono {
  font-family: var(--font-mono);
}

.muted {
  color: var(--text-dim);
}

.row-bad .value {
  color: var(--bad);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  position: sticky;
  bottom: 0;
  background: var(--bg-panel);
  padding-top: 0.5rem;
}

.btn {
  padding: 0.32rem 0.7rem;
  border: 1px solid transparent;
  font-size: 0.7rem;
}

.btn-secondary {
  background: var(--bg-inset);
  border-color: var(--border-strong);
  color: var(--text);
}

.btn-primary {
  background: var(--accent-dim);
  color: #fff6e5;
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
</style>
