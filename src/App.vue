<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import ConnectionBar from '@/components/ConnectionBar.vue'
import AddressSpaceTree from '@/components/AddressSpaceTree.vue'
import AttributesPanel from '@/components/AttributesPanel.vue'
import ReferencesPanel from '@/components/ReferencesPanel.vue'
import LogPanel from '@/components/LogPanel.vue'
import MiddleWorkspace from '@/components/MiddleWorkspace.vue'
import { usePanelLayout } from '@/shared/column-layout'
import { useConnectionStore } from '@/stores/connection'
import { useEventsStore } from '@/stores/events'
import { useMonitorStore } from '@/stores/monitor'
import { useNodeDetailStore } from '@/stores/node-detail'

const connectionStore = useConnectionStore()
const nodeDetailStore = useNodeDetailStore()
const monitorStore = useMonitorStore()
const eventsStore = useEventsStore()
const shellEl = ref<HTMLElement | null>(null)
const mainEl = ref<HTMLElement | null>(null)
const rightEl = ref<HTMLElement | null>(null)
const { dragging, columnTemplate, attrTemplate, shellTemplate, startDrag } =
  usePanelLayout(mainEl, rightEl, shellEl)

onMounted(() => {
  connectionStore.init()
  nodeDetailStore.init()
  monitorStore.init()
  eventsStore.init()
})

onUnmounted(() => {
  connectionStore.dispose()
  nodeDetailStore.dispose()
  void monitorStore.dispose()
  void eventsStore.dispose()
})
</script>

<template>
  <div
    ref="shellEl"
    class="app-shell"
    :class="{
      'resizing-col': dragging === 'left' || dragging === 'right',
      'resizing-row': dragging === 'attr' || dragging === 'log',
    }"
    :style="{ gridTemplateRows: shellTemplate }"
  >
    <ConnectionBar />

    <main
      ref="mainEl"
      class="main-grid"
      :style="{ gridTemplateColumns: columnTemplate }"
    >
      <aside class="panel address-space">
        <header class="panel-head">
          <span class="panel-mark" />
          <h2>Address Space</h2>
          <span class="panel-tag">Browse</span>
        </header>
        <AddressSpaceTree />
      </aside>

      <div
        class="col-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整 Address Space 与 Data Access 宽度"
        title="拖动调整列宽"
        @pointerdown="startDrag('left', $event)"
      />

      <section class="panel data-access">
        <header class="panel-head">
          <span class="panel-mark" />
          <h2>Monitor</h2>
          <span class="panel-tag">Data / Events</span>
        </header>
        <MiddleWorkspace />
      </section>

      <div
        class="col-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整 Data Access 与 Attributes 宽度"
        title="拖动调整列宽"
        @pointerdown="startDrag('right', $event)"
      />

      <aside
        ref="rightEl"
        class="panel right-stack"
        :style="{ gridTemplateRows: attrTemplate }"
      >
        <div class="sub-panel attributes">
          <header class="panel-head">
            <span class="panel-mark" />
            <h2>Attributes</h2>
            <span class="panel-tag">Node</span>
          </header>
          <AttributesPanel />
        </div>

        <div
          class="row-splitter"
          role="separator"
          aria-orientation="horizontal"
          aria-label="调整 Attributes 与 References 高度"
          title="拖动调整高度"
          @pointerdown="startDrag('attr', $event)"
        />

        <div class="sub-panel references">
          <header class="panel-head">
            <span class="panel-mark" />
            <h2>References</h2>
            <span class="panel-tag">Links</span>
          </header>
          <ReferencesPanel />
        </div>
      </aside>
    </main>

    <div
      class="row-splitter log-splitter"
      role="separator"
      aria-orientation="horizontal"
      aria-label="调整 Event Log 高度"
      title="拖动调整日志高度"
      @pointerdown="startDrag('log', $event)"
    />

    <LogPanel />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  height: 100%;
  min-height: 0;
}

.main-grid {
  display: grid;
  min-height: 0;
  overflow: hidden;
  background: var(--border);
  padding: 1px;
}

.panel {
  padding: 0.65rem 0.7rem 0.55rem;
  overflow: auto;
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.address-space,
.data-access {
  overflow: hidden;
}

.panel :deep(.middle-workspace) {
  flex: 1;
  min-height: 0;
}

.col-splitter,
.row-splitter {
  background: var(--border);
  position: relative;
  z-index: 2;
  touch-action: none;
}

.col-splitter {
  width: 6px;
  margin: 0 -1px;
  cursor: col-resize;
}

.row-splitter {
  height: 6px;
  margin: -1px 0;
  cursor: row-resize;
}

.log-splitter {
  margin: 0;
  z-index: 3;
}

.col-splitter::after,
.row-splitter::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--accent-dim);
  box-shadow: 0 0 6px rgba(232, 163, 23, 0.35);
}

.col-splitter::after {
  width: 2px;
  height: 2.4rem;
}

.row-splitter::after {
  width: 2.4rem;
  height: 2px;
}

.col-splitter:hover,
.app-shell.resizing-col .col-splitter,
.row-splitter:hover,
.app-shell.resizing-row .row-splitter {
  background: #3a2a12;
}

.col-splitter:hover::after,
.app-shell.resizing-col .col-splitter::after,
.row-splitter:hover::after,
.app-shell.resizing-row .row-splitter::after {
  background: var(--accent);
}

.right-stack {
  display: grid;
  padding: 0;
  background: var(--border);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sub-panel {
  padding: 0.65rem 0.7rem 0.55rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--bg-panel);
}

.sub-panel :deep(.attributes-panel),
.sub-panel :deep(.references-panel) {
  flex: 1;
  min-height: 0;
}
</style>
