<script setup lang="ts">
import { nextTick, watch } from 'vue'

import TreeNodeRow from '@/components/TreeNodeRow.vue'
import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'
import type { BrowseMode } from '@/opcua/browse-mode'

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

watch(
  () => addressSpace.selectedNodeId,
  async (nodeId) => {
    if (!nodeId) {
      return
    }
    await nextTick()
    const row = document.querySelector(
      `[data-node-id="${CSS.escape(nodeId)}"]`,
    ) as HTMLElement | null
    row?.scrollIntoView({ block: 'nearest' })
  },
)

function onSelect(nodeId: string): void {
  addressSpace.selectNode(nodeId)
}

function onToggle(nodeId: string): void {
  void addressSpace.toggleNode(nodeId)
}

function onBrowseMode(mode: BrowseMode): void {
  void addressSpace.setBrowseMode(mode)
}
</script>

<template>
  <div class="address-space-tree">
    <div v-if="!connection.isConnected" class="tree-hint">
      请先连接 OPC UA 服务器
    </div>

    <template v-else>
      <div class="tree-toolbar">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: addressSpace.browseMode === 'hierarchical' }"
          :disabled="addressSpace.loading"
          @click="onBrowseMode('hierarchical')"
        >
          层级引用
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: addressSpace.browseMode === 'all' }"
          :disabled="addressSpace.loading"
          @click="onBrowseMode('all')"
        >
          全部引用
        </button>
      </div>

      <div v-if="addressSpace.loading && !addressSpace.root" class="tree-hint">
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
    </template>

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

.tree-toolbar {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  margin-bottom: 0.4rem;
}

.mode-btn {
  padding: 0.18rem 0.5rem;
  border: 1px solid var(--border-strong);
  background: var(--bg-inset);
  color: var(--text-dim);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mode-btn.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: #fff6e5;
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
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.82rem;
}

.tree-error {
  margin: 0;
  color: var(--bad);
  font-size: 0.82rem;
}

.selection-bar {
  margin: 0.5rem 0 0;
  padding: 0.35rem 0.4rem 0 0;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.selection-bar code {
  font-size: 0.7rem;
  word-break: break-all;
  color: var(--cyan);
  text-transform: none;
  letter-spacing: 0;
}
</style>
