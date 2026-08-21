<script setup lang="ts">
import { watch } from 'vue'

import TreeNodeRow from '@/components/TreeNodeRow.vue'
import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()
const addressSpace = useAddressSpaceStore()

watch(
  () => connection.isConnected,
  (connected) => {
    if (connected) {
      void addressSpace.loadRoot()
    } else {
      addressSpace.reset()
    }
  },
  { immediate: true },
)

function onSelect(nodeId: string): void {
  addressSpace.selectNode(nodeId)
}

function onToggle(nodeId: string): void {
  void addressSpace.toggleNode(nodeId)
}
</script>

<template>
  <div class="address-space-tree">
    <div v-if="!connection.isConnected" class="tree-hint">
      请先连接 OPC UA 服务器
    </div>

    <div v-else-if="addressSpace.loading && !addressSpace.root" class="tree-hint">
      正在加载地址空间…
    </div>

    <div v-else-if="addressSpace.error && !addressSpace.root" class="tree-error">
      {{ addressSpace.error }}
    </div>

    <ul v-else-if="addressSpace.root" class="tree-root">
      <TreeNodeRow
        :node="addressSpace.root"
        :depth="0"
        :selected-node-id="addressSpace.selectedNodeId"
        @select="onSelect"
        @toggle="onToggle"
      />
    </ul>

    <div v-else class="tree-hint">地址空间为空</div>

    <p v-if="addressSpace.selectedNodeId" class="selection-bar">
      已选: <code>{{ addressSpace.selectedNodeId }}</code>
    </p>
  </div>
</template>

<style scoped>
.address-space-tree {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.tree-root {
  margin: 0;
  padding: 0;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.tree-hint {
  margin: 0;
  color: #8c959f;
  font-style: italic;
  font-size: 0.85rem;
}

.tree-error {
  margin: 0;
  color: #cf222e;
  font-size: 0.85rem;
}

.selection-bar {
  margin: 0.5rem 0 0;
  padding-top: 0.35rem;
  border-top: 1px solid #d0d7de;
  font-size: 0.75rem;
  color: #656d76;
}

.selection-bar code {
  font-size: 0.72rem;
  word-break: break-all;
}
</style>
