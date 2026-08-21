<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { callMethod, readMethodSignature } from '@/opcua/method'
import type { MethodCallResult, MethodSignature } from '@/opcua/types'
import { useLogStore } from '@/stores/log'

const props = defineProps<{
  visible: boolean
  methodId: string
  methodLabel?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const signature = ref<MethodSignature | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const inputTexts = ref<string[]>([])
const busy = ref(false)
const result = ref<MethodCallResult | null>(null)

const objectIdText = computed(() => signature.value?.objectId ?? '—')

const canCall = computed(
  () =>
    !loading.value &&
    !busy.value &&
    !!signature.value?.objectId &&
    !loadError.value,
)

watch(
  () => [props.visible, props.methodId] as const,
  ([visible, methodId]) => {
    if (visible && methodId) {
      void loadSignature(methodId)
    }
  },
  { immediate: true },
)

async function loadSignature(methodId: string): Promise<void> {
  loading.value = true
  loadError.value = null
  signature.value = null
  result.value = null
  inputTexts.value = []

  const log = useLogStore()

  try {
    const loaded = await readMethodSignature(methodId)
    signature.value = loaded
    inputTexts.value = loaded.inputArguments.map(() => '')

    if (!loaded.objectId) {
      loadError.value = '未找到方法的父 Object（HasComponent 反向引用）'
      log.warn(`方法 ${methodId}：无法解析 objectId`)
    } else {
      log.ok(
        `方法 ${methodId}：${loaded.inputArguments.length} 入参，${loaded.outputArguments.length} 出参`,
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    loadError.value = message
    log.err(`读取方法签名失败 (${methodId}): ${message}`)
  } finally {
    loading.value = false
  }
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

function formatArgMeta(arg: {
  dataTypeName: string
  valueRank: number
  description: string
}): string {
  const parts = [`${arg.dataTypeName}`, `Rank ${arg.valueRank}`]
  if (arg.description) {
    parts.push(arg.description)
  }
  return parts.join(' · ')
}

async function onCall(): Promise<void> {
  if (!signature.value?.objectId) {
    return
  }

  const log = useLogStore()
  busy.value = true
  result.value = null

  try {
    const callResult = await callMethod(
      signature.value.objectId,
      props.methodId,
      inputTexts.value,
      signature.value,
    )
    result.value = callResult

    if (callResult.isError) {
      log.err(`Call ${props.methodId} -> ${callResult.statusCode}`)
    } else {
      const outputs = callResult.outputs
        .map((item) => `${item.name}=${item.displayValue}`)
        .join(', ')
      log.ok(`Call ${props.methodId} -> ${callResult.statusCode}${outputs ? ` (${outputs})` : ''}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.value = {
      statusCode: message,
      isError: true,
      inputArgumentResults: [],
      outputs: [],
    }
    log.err(`Call 失败 (${props.methodId}): ${message}`)
  } finally {
    busy.value = false
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
    <div class="dialog" role="dialog" aria-labelledby="method-call-title">
      <header class="dialog-header">
        <h3 id="method-call-title">调用方法</h3>
        <button
          type="button"
          class="btn-close"
          aria-label="关闭"
          :disabled="busy"
          @click="onCancel"
        >
          ×
        </button>
      </header>

      <p class="method-name">{{ methodLabel || methodId }}</p>
      <p class="node-id">Method: {{ methodId }}</p>
      <p class="node-id">Object: {{ objectIdText }}</p>

      <div v-if="loading" class="panel-hint">正在读取方法参数…</div>
      <div v-else-if="loadError" class="panel-error">{{ loadError }}</div>

      <template v-else-if="signature">
        <section class="section">
          <h4>输入参数</h4>
          <p v-if="signature.inputArguments.length === 0" class="panel-hint">
            无输入参数
          </p>
          <div
            v-for="(arg, index) in signature.inputArguments"
            :key="`in-${arg.name}-${index}`"
            class="field"
          >
            <label class="field-label">
              {{ arg.name }}
              <span class="field-meta">{{ formatArgMeta(arg) }}</span>
            </label>
            <input
              v-model="inputTexts[index]"
              type="text"
              class="field-input"
              :placeholder="arg.dataTypeName === 'Boolean' ? 'true / false' : arg.dataTypeName"
              :disabled="busy"
            />
          </div>
        </section>

        <section class="section">
          <h4>输出参数（定义）</h4>
          <p v-if="signature.outputArguments.length === 0" class="panel-hint">
            无输出参数
          </p>
          <ul v-else class="arg-list">
            <li v-for="arg in signature.outputArguments" :key="arg.name">
              <strong>{{ arg.name }}</strong>
              <span>{{ formatArgMeta(arg) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="result" class="section result-section">
          <h4>调用结果</h4>
          <p :class="result.isError ? 'result-bad' : 'result-ok'">
            Status: {{ result.statusCode }}
          </p>
          <p
            v-for="(status, index) in result.inputArgumentResults"
            :key="`in-result-${index}`"
            class="result-meta"
          >
            Input[{{ index }}]: {{ status }}
          </p>
          <ul v-if="result.outputs.length > 0" class="arg-list">
            <li v-for="output in result.outputs" :key="output.name">
              <strong>{{ output.name }}</strong>
              <span class="mono">{{ output.displayValue }}</span>
              <span class="result-meta">({{ output.dataTypeName }})</span>
            </li>
          </ul>
        </section>
      </template>

      <footer class="dialog-footer">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="busy"
          @click="onCancel"
        >
          关闭
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canCall"
          @click="onCall"
        >
          {{ busy ? '调用中…' : '执行 Call' }}
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
  background: rgba(27, 31, 36, 0.45);
  padding: 1rem;
}

.dialog {
  width: min(34rem, 100%);
  max-height: min(90vh, 42rem);
  overflow: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(27, 31, 36, 0.2);
  padding: 1rem 1rem 0.85rem;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1rem;
}

.btn-close {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: #656d76;
}

.method-name {
  margin: 0 0 0.25rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.node-id {
  margin: 0 0 0.2rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  color: #57606a;
  word-break: break-all;
}

.section {
  margin-top: 0.85rem;
}

.section h4 {
  margin: 0 0 0.45rem;
  font-size: 0.82rem;
  color: #656d76;
}

.panel-hint {
  margin: 0;
  color: #8c959f;
  font-style: italic;
  font-size: 0.78rem;
}

.panel-error {
  margin: 0.5rem 0 0;
  color: #cf222e;
  font-size: 0.82rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.55rem;
}

.field-label {
  font-size: 0.78rem;
  color: #24292f;
}

.field-meta {
  display: block;
  margin-top: 0.1rem;
  color: #8c959f;
  font-size: 0.72rem;
  font-weight: normal;
}

.field-input {
  padding: 0.4rem 0.55rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 0.85rem;
}

.arg-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.78rem;
  color: #57606a;
}

.arg-list li {
  margin-bottom: 0.25rem;
}

.arg-list strong {
  margin-right: 0.35rem;
  color: #24292f;
}

.result-section {
  border-top: 1px solid #d0d7de;
  padding-top: 0.65rem;
}

.result-ok {
  margin: 0 0 0.35rem;
  color: #1a7f37;
  font-size: 0.82rem;
}

.result-bad {
  margin: 0 0 0.35rem;
  color: #cf222e;
  font-size: 0.82rem;
}

.result-meta {
  margin: 0 0 0.2rem;
  font-size: 0.72rem;
  color: #656d76;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  position: sticky;
  bottom: 0;
  background: #fff;
  padding-top: 0.5rem;
}

.btn {
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f6f8fa;
  border-color: #d0d7de;
  color: #24292f;
}

.btn-primary {
  background: #0969da;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #0550ae;
}
</style>
