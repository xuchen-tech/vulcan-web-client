<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import ConnectionBar from '@/components/ConnectionBar.vue'
import AddressSpaceTree from '@/components/AddressSpaceTree.vue'
import AttributesPanel from '@/components/AttributesPanel.vue'
import ReferencesPanel from '@/components/ReferencesPanel.vue'
import DataAccessView from '@/components/DataAccessView.vue'
import LogPanel from '@/components/LogPanel.vue'
import { useConnectionStore } from '@/stores/connection'
import { useMonitorStore } from '@/stores/monitor'
import { useNodeDetailStore } from '@/stores/node-detail'

const connectionStore = useConnectionStore()
const nodeDetailStore = useNodeDetailStore()
const monitorStore = useMonitorStore()

onMounted(() => {
  connectionStore.init()
  nodeDetailStore.init()
  monitorStore.init()
})

onUnmounted(() => {
  connectionStore.dispose()
  nodeDetailStore.dispose()
  void monitorStore.dispose()
})
</script>

<template>
  <div class="app-shell">
    <ConnectionBar />

    <main class="main-grid">
      <aside class="panel address-space">
        <h2>Address Space</h2>
        <AddressSpaceTree />
      </aside>

      <section class="panel data-access">
        <h2>Data Access</h2>
        <DataAccessView />
      </section>

      <aside class="panel right-stack">
        <div class="sub-panel attributes">
          <h2>Attributes</h2>
          <AttributesPanel />
        </div>
        <div class="sub-panel references">
          <h2>References</h2>
          <ReferencesPanel />
        </div>
      </aside>
    </main>

    <LogPanel />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  min-height: 0;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(280px, 1.4fr) minmax(240px, 1fr);
  min-height: 0;
  overflow: hidden;
}

.panel {
  padding: 0.75rem;
  border-right: 1px solid #d0d7de;
  overflow: auto;
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.address-space,
.data-access {
  overflow: hidden;
}

.panel :deep(.data-access-view) {
  flex: 1;
  min-height: 0;
}

.panel:last-child {
  border-right: none;
}

.right-stack {
  display: grid;
  grid-template-rows: 1fr 1fr;
  padding: 0;
  gap: 0;
}

.sub-panel {
  padding: 0.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sub-panel h2 {
  flex-shrink: 0;
}

.sub-panel :deep(.attributes-panel),
.sub-panel :deep(.references-panel) {
  flex: 1;
  min-height: 0;
}

.attributes {
  border-bottom: 1px solid #d0d7de;
}

.placeholder {
  margin: 0;
  color: #8c959f;
  font-style: italic;
}
</style>
