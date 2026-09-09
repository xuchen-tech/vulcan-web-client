<script setup lang="ts">
import { computed } from 'vue'

import { NodeClass } from '@wsopcua/wsopcua/data-model'

import { encodeDraggedNode, OPCUA_NODE_DRAG_TYPE } from '@/shared/drag-drop'
import { nodeClassIcon, nodeClassLabel, nodeClassTone } from '@/shared/nodeclass-icons'
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
const isDraggable = computed(() => props.node.nodeClass === NodeClass.Variable)
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

function onDragStart(event: DragEvent): void {
  if (!isDraggable.value || !event.dataTransfer) {
    return
  }

  event.dataTransfer.setData(
    OPCUA_NODE_DRAG_TYPE,
    encodeDraggedNode({
      nodeId: props.node.nodeId,
      displayName: props.node.displayName,
    }),
  )
  event.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <li class="tree-node">
    <div
      class="tree-row"
      :class="{ selected: isSelected, draggable: isDraggable }"
      :style="{ paddingLeft: `${depth * 0.85 + 0.25}rem` }"
      :draggable="isDraggable"
      @click="onRowClick"
      @dragstart="onDragStart"
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

      <span
        class="node-icon"
        :class="nodeClassTone(node.nodeClass)"
        :title="nodeClassLabel(node.nodeClass)"
      >
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
  padding: 0.12rem 0.35rem 0.12rem 0;
  border-radius: var(--radius);
  cursor: pointer;
  user-select: none;
  line-height: 1.35;
}

.tree-row:hover {
  background: var(--bg-hover);
}

.tree-row.selected {
  background: var(--bg-selected);
  box-shadow: inset 2px 0 0 var(--cyan);
}

.tree-row.draggable {
  cursor: grab;
}

.tree-row.draggable:active {
  cursor: grabbing;
}

.expand-btn {
  width: 1.1rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.6rem;
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
  flex-shrink: 0;
  font-size: 0.72rem;
}

.tone-object { color: var(--accent); }
.tone-variable { color: var(--cyan); }
.tone-method { color: #d9b44a; }
.tone-type { color: #8fb3d9; }
.tone-ref { color: #a78bfa; }
.tone-data { color: #67e8f9; }
.tone-view { color: #86efac; }
.tone-unknown { color: var(--text-muted); }

.node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}

.tree-row.selected .node-label {
  color: var(--cyan);
}

.node-id {
  color: var(--text-dim);
  font-size: 0.68rem;
  font-family: var(--font-mono);
  flex-shrink: 0;
  max-width: 6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
