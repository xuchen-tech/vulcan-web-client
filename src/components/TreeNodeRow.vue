<script setup lang="ts">
import { computed } from 'vue'

import { nodeClassIcon, nodeClassLabel } from '@/shared/nodeclass-icons'
import type { TreeNode } from '@/stores/address-space'

defineOptions({ name: 'TreeNodeRow' })

const props = defineProps<{
  node: TreeNode
  depth: number
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  toggle: [nodeId: string]
}>()

const isSelected = computed(() => props.selectedNodeId === props.node.nodeId)
const showExpand = computed(() => !props.node.isLeaf)
const expandLabel = computed(() => {
  if (props.node.loading) {
    return '…'
  }
  return props.node.expanded ? '▼' : '▶'
})

function onRowClick(): void {
  emit('select', props.node.nodeId)
}

function onToggleClick(event: MouseEvent): void {
  event.stopPropagation()
  emit('toggle', props.node.nodeId)
}
</script>

<template>
  <li class="tree-node">
    <div
      class="tree-row"
      :class="{ selected: isSelected }"
      :style="{ paddingLeft: `${depth * 0.85 + 0.25}rem` }"
      @click="onRowClick"
    >
      <button
        v-if="showExpand"
        type="button"
        class="expand-btn"
        :aria-expanded="node.expanded"
        :disabled="node.loading"
        @click="onToggleClick"
      >
        {{ expandLabel }}
      </button>
      <span v-else class="expand-spacer" />

      <span class="node-icon" :title="nodeClassLabel(node.nodeClass)">
        {{ nodeClassIcon(node.nodeClass) }}
      </span>
      <span class="node-label" :title="node.nodeId">{{ node.displayName }}</span>
      <span class="node-id">{{ node.browseName }}</span>
    </div>

    <ul v-if="node.expanded && node.children.length > 0" class="tree-children">
      <TreeNodeRow
        v-for="child in node.children"
        :key="child.nodeId"
        :node="child"
        :depth="depth + 1"
        :selected-node-id="selectedNodeId"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.tree-node {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree-children {
  margin: 0;
  padding: 0;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.35rem 0.15rem 0;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  line-height: 1.35;
}

.tree-row:hover {
  background: #eaeef2;
}

.tree-row.selected {
  background: #ddf4ff;
}

.expand-btn {
  width: 1.1rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #656d76;
  font-size: 0.65rem;
  cursor: pointer;
  flex-shrink: 0;
}

.expand-btn:disabled {
  cursor: wait;
}

.expand-spacer {
  display: inline-block;
  width: 1.1rem;
  flex-shrink: 0;
}

.node-icon {
  width: 1rem;
  text-align: center;
  color: #57606a;
  flex-shrink: 0;
  font-size: 0.75rem;
}

.node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}

.node-id {
  color: #8c959f;
  font-size: 0.72rem;
  flex-shrink: 0;
  max-width: 6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
