<script setup lang="ts">
import { computed, ref } from 'vue'

import MethodCallDialog from '@/components/MethodCallDialog.vue'
import WriteValueDialog from '@/components/WriteValueDialog.vue'
import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'
import { useMonitorStore } from '@/stores/monitor'
import { useNodeDetailStore } from '@/stores/node-detail'

const connection = useConnectionStore()
const addressSpace = useAddressSpaceStore()
const nodeDetail = useNodeDetailStore()
const monitor = useMonitorStore()

const writeDialogOpen = ref(false)
const methodDialogOpen = ref(false)

const selectedMethodLabel = computed(
  () => addressSpace.getSelectedNode()?.displayName ?? '',
)

function onReadValue(): void {
  void nodeDetail.readSelectedValue()
}

function openWriteDialog(): void {
  writeDialogOpen.value = true
}

function closeWriteDialog(): void {
  writeDialogOpen.value = false
}

async function onWriteSubmit(value: string): Promise<void> {
  const ok = await nodeDetail.writeSelectedValue(value)
  if (ok) {
    writeDialogOpen.value = false
  }
}

function onAddMonitor(): void {
  void monitor.addSelectedNode()
}

function openMethodDialog(): void {
  methodDialogOpen.value = true
}

function closeMethodDialog(): void {
  methodDialogOpen.value = false
}
</script>

<template>
  <div class="attributes-panel">
    <div v-if="!connection.isConnected" class="panel-hint">
      请先连接 OPC UA 服务器
    </div>

    <div v-else-if="!addressSpace.selectedNodeId" class="panel-hint">
      在左侧地址空间选择节点
    </div>

    <template v-else>
      <div v-if="addressSpace.isSelectedMethod" class="value-actions">
        <button type="button" class="btn btn-method" @click="openMethodDialog">
          调用方法
        </button>
      </div>

      <div v-else-if="nodeDetail.canReadWriteValue" class="value-actions">
        <button
          type="button"
          class="btn btn-read"
          :disabled="nodeDetail.valueBusy"
          @click="onReadValue"
        >
          读 Value
        </button>
        <button
          type="button"
          class="btn btn-write"
          :disabled="nodeDetail.valueBusy"
          @click="openWriteDialog"
        >
          写 Value
        </button>
        <button
          type="button"
          class="btn btn-monitor"
          :disabled="monitor.busy"
          @click="onAddMonitor"
        >
          加入监视
        </button>
      </div>

      <div v-else-if="!nodeDetail.attrsLoading && !nodeDetail.attrsError" class="panel-hint compact">
        当前节点非 Variable / Method，Value 读/写不可用
      </div>

      <div v-if="nodeDetail.attrsLoading" class="panel-hint">
        正在读取属性…
      </div>

      <div v-else-if="nodeDetail.attrsError" class="panel-error">
        {{ nodeDetail.attrsError }}
      </div>

      <div v-else class="table-wrap">
        <table class="attr-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in nodeDetail.attributes"
              :key="row.attributeId"
              :class="{ 'row-bad': row.isError, 'row-value': row.attributeName === 'Value' }"
            >
              <td class="col-name">{{ row.attributeName }}</td>
              <td class="col-value">
                <div class="value-main">{{ row.displayValue }}</div>
                <div v-if="row.detail" class="value-detail">{{ row.detail }}</div>
              </td>
              <td class="col-status">{{ row.statusCode }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <WriteValueDialog
      :visible="writeDialogOpen"
      :node-id="addressSpace.selectedNodeId ?? ''"
      :initial-value="nodeDetail.currentValueText"
      :data-type-hint="nodeDetail.dataTypeHint"
      :value-rank="nodeDetail.valueRankHint"
      :busy="nodeDetail.valueBusy"
      @close="closeWriteDialog"
      @submit="onWriteSubmit"
    />

    <MethodCallDialog
      :visible="methodDialogOpen"
      :method-id="addressSpace.selectedNodeId ?? ''"
      :method-label="selectedMethodLabel"
      @close="closeMethodDialog"
    />
  </div>
</template>

<style scoped>
.attributes-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 0.5rem;
}

.value-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.25rem 0.6rem;
  border: 1px solid transparent;
  font-size: 0.7rem;
}

.btn-read {
  background: var(--bg-inset);
  border-color: var(--border-strong);
  color: var(--text);
}

.btn-write {
  background: var(--accent-dim);
  color: #fff6e5;
  border-color: var(--accent);
}

.btn-write:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-monitor {
  background: var(--cyan-dim);
  color: #d8fffb;
  border-color: var(--cyan);
}

.btn-monitor:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-method {
  background: #6b5210;
  color: #fff6e5;
  border-color: var(--accent);
}

.btn-method:hover:not(:disabled) {
  filter: brightness(1.08);
}

.panel-hint {
  margin: 0;
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.82rem;
}

.panel-hint.compact {
  font-size: 0.75rem;
}

.panel-error {
  margin: 0;
  color: var(--bad);
  font-size: 0.82rem;
}

.table-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  background: var(--bg-inset);
}

.attr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.attr-table th,
.attr-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.32rem 0.4rem;
  text-align: left;
  vertical-align: top;
}

.attr-table tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.015);
}

.attr-table th {
  position: sticky;
  top: 0;
  background: var(--bg-table-head);
  color: var(--accent);
  font-weight: 700;
  z-index: 1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.65rem;
}

.col-name {
  white-space: nowrap;
  color: var(--text-muted);
  width: 38%;
}

.col-value {
  word-break: break-word;
}

.col-status {
  white-space: nowrap;
  color: var(--text-dim);
  font-size: 0.68rem;
  max-width: 7rem;
  font-family: var(--font-mono);
}

.value-main {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--cyan);
}

.value-detail {
  margin-top: 0.2rem;
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.35;
}

.row-bad .value-main {
  color: var(--bad);
}

.row-value .col-name {
  font-weight: 700;
  color: var(--accent);
}
</style>
