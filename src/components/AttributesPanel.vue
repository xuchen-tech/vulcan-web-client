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
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 0.78rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-read {
  background: #f6f8fa;
  border-color: #d0d7de;
  color: #24292f;
}

.btn-write {
  background: #0969da;
  color: #fff;
}

.btn-write:hover:not(:disabled) {
  background: #0550ae;
}

.btn-monitor {
  background: #8250df;
  color: #fff;
}

.btn-monitor:hover:not(:disabled) {
  background: #6639ba;
}

.btn-method {
  background: #bf8700;
  color: #fff;
}

.btn-method:hover:not(:disabled) {
  background: #9a6700;
}

.panel-hint {
  margin: 0;
  color: #8c959f;
  font-style: italic;
  font-size: 0.85rem;
}

.panel-hint.compact {
  font-size: 0.78rem;
}

.panel-error {
  margin: 0;
  color: #cf222e;
  font-size: 0.85rem;
}

.table-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.attr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.attr-table th,
.attr-table td {
  border-bottom: 1px solid #d0d7de;
  padding: 0.35rem 0.4rem;
  text-align: left;
  vertical-align: top;
}

.attr-table th {
  position: sticky;
  top: 0;
  background: #f6f8fa;
  color: #656d76;
  font-weight: 600;
  z-index: 1;
}

.col-name {
  white-space: nowrap;
  color: #57606a;
  width: 38%;
}

.col-value {
  word-break: break-word;
}

.col-status {
  white-space: nowrap;
  color: #656d76;
  font-size: 0.72rem;
  max-width: 7rem;
}

.value-main {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
}

.value-detail {
  margin-top: 0.2rem;
  color: #656d76;
  font-size: 0.72rem;
  line-height: 1.35;
}

.row-bad .value-main {
  color: #cf222e;
}

.row-value .col-name {
  font-weight: 600;
}
</style>
