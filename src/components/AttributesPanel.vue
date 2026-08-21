<script setup lang="ts">
import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'
import { useNodeDetailStore } from '@/stores/node-detail'

const connection = useConnectionStore()
const addressSpace = useAddressSpaceStore()
const nodeDetail = useNodeDetailStore()
</script>

<template>
  <div class="attributes-panel">
    <div v-if="!connection.isConnected" class="panel-hint">
      请先连接 OPC UA 服务器
    </div>

    <div v-else-if="!addressSpace.selectedNodeId" class="panel-hint">
      在左侧地址空间选择节点
    </div>

    <div v-else-if="nodeDetail.attrsLoading" class="panel-hint">
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
            :class="{ 'row-bad': row.isError }"
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
  </div>
</template>

<style scoped>
.attributes-panel {
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
</style>
