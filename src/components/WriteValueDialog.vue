<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  nodeId: string
  initialValue?: string
  dataTypeHint?: string
  valueRank?: number
  busy?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [value: string]
}>()

const input = ref('')

const hintText = computed(() => {
  const parts: string[] = []
  if (props.dataTypeHint) {
    parts.push(`DataType: ${props.dataTypeHint}`)
  }
  if (props.valueRank != null) {
    parts.push(`ValueRank: ${props.valueRank}`)
  }
  if (props.valueRank != null && props.valueRank > 0) {
    parts.push('数组用逗号分隔')
  }
  return parts.join(' · ')
})

watch(
  () => props.visible,
  (open) => {
    if (open) {
      input.value = props.initialValue ?? ''
    }
  },
)

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

function onCancel(): void {
  emit('close')
}

function onSubmit(): void {
  emit('submit', input.value)
}
</script>

<template>
  <div
    v-if="visible"
    class="dialog-backdrop"
    role="presentation"
    @click="onBackdropClick"
  >
    <div class="dialog" role="dialog" aria-labelledby="write-value-title">
      <header class="dialog-header">
        <h3 id="write-value-title">写 Value</h3>
        <button type="button" class="btn-close" aria-label="关闭" @click="onCancel">
          ×
        </button>
      </header>

      <p class="node-id">{{ nodeId }}</p>
      <p v-if="hintText" class="hint">{{ hintText }}</p>

      <label class="field">
        <span class="field-label">新值</span>
        <input
          v-model="input"
          type="text"
          class="field-input"
          placeholder="true / 42 / 3.14 / text / 1,2,3"
          :disabled="busy"
          @keyup.enter="onSubmit"
        />
      </label>

      <footer class="dialog-footer">
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="onCancel">
          取消
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="onSubmit">
          {{ busy ? '写入中…' : '写入并读回' }}
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
  width: min(28rem, 100%);
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

.node-id {
  margin: 0 0 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--cyan);
  word-break: break-all;
}

.hint {
  margin: 0 0 0.75rem;
  font-size: 0.72rem;
  color: var(--text-dim);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.68rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field-input {
  padding: 0.45rem 0.55rem;
  font-size: 0.85rem;
  font-family: var(--font-mono);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid transparent;
  font-size: 0.72rem;
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
