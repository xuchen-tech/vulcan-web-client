<script setup lang="ts">
import { ref } from 'vue'

import { decodeDraggedNode, OPCUA_NODE_DRAG_TYPE } from '@/shared/drag-drop'
import { useConnectionStore } from '@/stores/connection'
import { useMonitorStore } from '@/stores/monitor'

const connection = useConnectionStore()
const monitor = useMonitorStore()
const dropActive = ref(false)

function onApplySettings(): void {
  void monitor.applySettings()
}

function onAddSelected(): void {
  void monitor.addSelectedNode()
}

function onRemove(nodeId: string): void {
  void monitor.removeRow(nodeId)
}

function onWrite(nodeId: string): void {
  void monitor.writeRow(nodeId, monitor.getWriteDraft(nodeId))
}

function onDraftInput(nodeId: string, event: Event): void {
  const input = event.target as HTMLInputElement
  monitor.setWriteDraft(nodeId, input.value)
}

function onDragOver(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes(OPCUA_NODE_DRAG_TYPE)) {
    return
  }

  event.dataTransfer.dropEffect = 'copy'
  dropActive.value = true
}

function onDragLeave(event: DragEvent): void {
  const related = event.relatedTarget as Node | null
  const current = event.currentTarget as HTMLElement
  if (related && current.contains(related)) {
    return
  }
  dropActive.value = false
}

function onDrop(event: DragEvent): void {
  dropActive.value = false
  const node = decodeDraggedNode(
    event.dataTransfer?.getData(OPCUA_NODE_DRAG_TYPE) ?? '',
  )
  if (node) {
    void monitor.addNode(node.nodeId, node.displayName)
  }
}
</script>

<template>
  <div
    class="data-access-view"
    :class="{ 'drop-active': dropActive }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div v-if="!connection.isConnected" class="panel-hint">
      请先连接 OPC UA 服务器
    </div>

    <template v-else>
      <div class="toolbar">
        <button
          type="button"
          class="btn btn-add"
          :disabled="monitor.busy"
          @click="onAddSelected"
        >
          加入监视
        </button>

        <label class="setting">
          <span>发布 ms</span>
          <input
            v-model.number="monitor.publishingInterval"
            type="number"
            min="100"
            step="100"
            class="num-input"
            :disabled="monitor.busy"
          />
        </label>
        <label class="setting">
          <span>采样 ms</span>
          <input
            v-model.number="monitor.samplingInterval"
            type="number"
            min="100"
            step="100"
            class="num-input"
            :disabled="monitor.busy"
          />
        </label>
        <label class="setting">
          <span>队列</span>
          <input
            v-model.number="monitor.queueSize"
            type="number"
            min="1"
            step="1"
            class="num-input narrow"
            :disabled="monitor.busy"
          />
        </label>
        <button
          type="button"
          class="btn btn-apply"
          :disabled="monitor.busy || !monitor.hasRows"
          @click="onApplySettings"
        >
          应用
        </button>

        <span v-if="monitor.degraded" class="badge-degraded">轮询降级</span>
      </div>

      <p v-if="monitor.statusHint" class="status-hint">{{ monitor.statusHint }}</p>

      <div v-if="!monitor.hasRows" class="panel-hint">
        在地址空间选中 Variable 后点击「加入监视」，或将 Variable 节点拖入此区域
      </div>

      <div v-else class="table-wrap">
        <table class="monitor-table">
          <thead>
            <tr>
              <th>NodeId</th>
              <th>Value</th>
              <th>DataType</th>
              <th>SourceTs</th>
              <th>ServerTs</th>
              <th>Status</th>
              <th>Write</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in monitor.rows"
              :key="row.nodeId"
              :class="{ 'row-bad': row.isError }"
            >
              <td class="col-node" :title="row.nodeId">
                <div class="node-label">{{ row.label }}</div>
                <div class="node-id">{{ row.nodeId }}</div>
              </td>
              <td class="col-value mono">{{ row.value }}</td>
              <td>{{ row.dataType }}</td>
              <td class="col-ts">{{ row.sourceTimestamp }}</td>
              <td class="col-ts">{{ row.serverTimestamp }}</td>
              <td class="col-status">{{ row.statusCode }}</td>
              <td class="col-write">
                <input
                  type="text"
                  class="write-input"
                  :value="monitor.getWriteDraft(row.nodeId)"
                  :disabled="row.writeBusy || monitor.busy"
                  @input="onDraftInput(row.nodeId, $event)"
                  @keyup.enter="onWrite(row.nodeId)"
                />
                <button
                  type="button"
                  class="btn btn-write"
                  :disabled="row.writeBusy || monitor.busy"
                  @click="onWrite(row.nodeId)"
                >
                  写
                </button>
              </td>
              <td>
                <button
                  type="button"
                  class="btn btn-remove"
                  :disabled="monitor.busy"
                  @click="onRemove(row.nodeId)"
                >
                  移除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.data-access-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 0.5rem;
}

.data-access-view.drop-active {
  outline: 1px dashed var(--cyan);
  outline-offset: -2px;
  background: rgba(62, 207, 192, 0.06);
}

.status-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.setting {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.num-input {
  width: 4.5rem;
  padding: 0.2rem 0.35rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.num-input.narrow {
  width: 3rem;
}

.btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid transparent;
  font-size: 0.7rem;
}

.btn-add {
  background: var(--cyan-dim);
  color: #d8fffb;
  border-color: var(--cyan);
}

.btn-apply {
  background: var(--bg-inset);
  border-color: var(--border-strong);
  color: var(--text);
}

.btn-write {
  background: var(--accent-dim);
  color: #fff6e5;
  border-color: var(--accent);
  padding: 0.18rem 0.45rem;
}

.btn-remove {
  background: transparent;
  border-color: #6b3030;
  color: var(--bad);
}

.badge-degraded {
  font-size: 0.68rem;
  color: var(--warn);
  background: rgba(232, 163, 23, 0.12);
  border: 1px solid var(--accent-dim);
  padding: 0.1rem 0.45rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panel-hint {
  margin: 0;
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.82rem;
}

.table-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  background: var(--bg-inset);
}

.monitor-table {
  width: 100%;
  min-width: 52rem;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.monitor-table th,
.monitor-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.32rem 0.4rem;
  text-align: left;
  vertical-align: top;
}

.monitor-table tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.015);
}

.monitor-table tbody tr:hover {
  background: var(--bg-hover);
}

.monitor-table th {
  position: sticky;
  top: 0;
  background: var(--bg-table-head);
  color: var(--accent);
  font-weight: 700;
  z-index: 1;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.65rem;
}

.col-node {
  min-width: 9rem;
}

.node-label {
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-id {
  font-size: 0.65rem;
  color: var(--text-dim);
  font-family: var(--font-mono);
  word-break: break-all;
}

.mono {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--cyan);
}

.col-ts {
  white-space: nowrap;
  font-size: 0.65rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.col-status {
  font-size: 0.65rem;
  max-width: 6rem;
  word-break: break-word;
  color: var(--text-muted);
}

.col-write {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  min-width: 8rem;
}

.write-input {
  flex: 1;
  min-width: 4rem;
  padding: 0.18rem 0.32rem;
  font-size: 0.7rem;
  font-family: var(--font-mono);
}

.row-bad .col-value {
  color: var(--bad);
}
</style>
