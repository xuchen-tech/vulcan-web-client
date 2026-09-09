<script setup lang="ts">
import { computed } from 'vue'

import DataAccessView from '@/components/DataAccessView.vue'
import EventView from '@/components/EventView.vue'
import { useEventsStore } from '@/stores/events'
import type { MiddlePanelTab } from '@/opcua/types'

const events = useEventsStore()

const activeTab = computed({
  get: (): MiddlePanelTab => events.middlePanelTab,
  set: (value: MiddlePanelTab) => {
    events.middlePanelTab = value
  },
})
</script>

<template>
  <div class="middle-workspace">
    <nav class="tab-bar" aria-label="中间栏视图切换">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'data-access' }"
        @click="activeTab = 'data-access'"
      >
        Data Access
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'events' }"
        @click="activeTab = 'events'"
      >
        Events
        <span v-if="events.hasSubscriptions" class="tab-dot" title="已有事件订阅" />
      </button>
    </nav>

    <div class="tab-panel">
      <DataAccessView v-show="activeTab === 'data-access'" />
      <EventView v-show="activeTab === 'events'" />
    </div>
  </div>
</template>

<style scoped>
.middle-workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 0.45rem;
}

.tab-bar {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.tab-btn {
  padding: 0.22rem 0.65rem;
  border: 1px solid var(--border-strong);
  background: var(--bg-inset);
  color: var(--text-dim);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.tab-btn.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: #fff6e5;
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 4px var(--cyan);
}

.tab-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tab-panel :deep(.data-access-view),
.tab-panel :deep(.event-view) {
  flex: 1;
  min-height: 0;
}
</style>
