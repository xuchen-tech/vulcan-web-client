<script setup lang="ts">
import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'
import { useNodeDetailStore } from '@/stores/node-detail'

const connection = useConnectionStore()
const addressSpace = useAddressSpaceStore()
const nodeDetail = useNodeDetailStore()

function onLocate(nodeId: string): void {
  void addressSpace.locateNode(nodeId)
}
</script>

<template>
  <div class="references-panel">
    <div v-if="!connection.isConnected" class="panel-hint">
      请先连接 OPC UA 服务器
    </div>

    <div v-else-if="!addressSpace.selectedNodeId" class="panel-hint">
      在左侧地址空间选择节点
    </div>

    <div v-else-if="nodeDetail.refsLoading" class="panel-hint">
      正在读取引用…
    </div>

    <div v-else-if="nodeDetail.refsError" class="panel-error">
      {{ nodeDetail.refsError }}
    </div>

    <div v-else-if="nodeDetail.references.length === 0" class="panel-hint">
      无引用
    </div>

    <div v-else class="table-wrap">
      <table class="ref-table">
        <thead>
          <tr>
            <th>Reference Type</th>
            <th>Dir</th>
            <th>Browse Name</th>
            <th>NodeId</th>
            <th>Node Class</th>
            <th>Type Definition</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in nodeDetail.references"
            :key="`${row.referenceType}-${row.targetNodeId}-${index}`"
            class="ref-row"
            :title="addressSpace.locating ? '正在定位…' : '双击在地址空间中定位'"
            @dblclick="onLocate(row.targetNodeId)"
          >
            <td>{{ row.referenceType }}</td>
            <td>{{ row.isForward ? 'Forward' : 'Inverse' }}</td>
            <td>{{ row.targetBrowseName }}</td>
            <td class="mono">{{ row.targetNodeId }}</td>
            <td>{{ row.targetNodeClass }}</td>
            <td class="mono">{{ row.typeDefinition }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.references-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.panel-hint {
  margin: 0;
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.82rem;
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

.ref-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.ref-table th,
.ref-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.28rem 0.35rem;
  text-align: left;
  vertical-align: top;
}

.ref-table tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.015);
}

.ref-row {
  cursor: pointer;
}

.ref-row:hover {
  background: var(--bg-hover);
}

.ref-table th {
  position: sticky;
  top: 0;
  background: var(--bg-table-head);
  color: var(--accent);
  font-weight: 700;
  z-index: 1;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.62rem;
}

.mono {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  word-break: break-all;
  color: var(--cyan);
}
</style>
