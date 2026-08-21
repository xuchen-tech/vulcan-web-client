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
  background: rgba(27, 31, 36, 0.45);
  padding: 1rem;
}

.dialog {
  width: min(28rem, 100%);
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

.node-id {
  margin: 0 0 0.35rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  color: #57606a;
  word-break: break-all;
}

.hint {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  color: #8c959f;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.75rem;
  color: #656d76;
}

.field-input {
  padding: 0.45rem 0.55rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 0.9rem;
}

.field-input:disabled {
  opacity: 0.6;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
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
