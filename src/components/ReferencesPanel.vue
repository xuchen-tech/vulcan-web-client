<script setup lang="ts">
import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'
import { useNodeDetailStore } from '@/stores/node-detail'

const connection = useConnectionStore()
const addressSpace = useAddressSpaceStore()
const nodeDetail = useNodeDetailStore()
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
          <tr v-for="(row, index) in nodeDetail.references" :key="`${row.referenceType}-${row.targetNodeId}-${index}`">
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
  color: #8c959f;
  font-style: italic;
  font-size: 0.85rem;
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

.ref-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.ref-table th,
.ref-table td {
  border-bottom: 1px solid #d0d7de;
  padding: 0.3rem 0.35rem;
  text-align: left;
  vertical-align: top;
}

.ref-table th {
  position: sticky;
  top: 0;
  background: #f6f8fa;
  color: #656d76;
  font-weight: 600;
  z-index: 1;
  white-space: nowrap;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  word-break: break-all;
}
</style>
