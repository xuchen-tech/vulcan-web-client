<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { useAddressSpaceStore } from '@/stores/address-space'
import { useConnectionStore } from '@/stores/connection'
import { useEventsStore } from '@/stores/events'

const connection = useConnectionStore()
const events = useEventsStore()
const addressSpace = useAddressSpaceStore()
const tableWrap = ref<HTMLElement | null>(null)

watch(
  () => events.rows.length,
  async () => {
    if (!events.autoScroll || !tableWrap.value) {
      return
    }
    await nextTick()
    tableWrap.value.scrollTop = 0
  },
)

function onSubscribeServer(): void {
  void events.subscribeServerDefault()
}

function onSubscribeSelected(): void {
  void events.subscribeSelectedNode()
}

function onUnsubscribe(nodeId: string): void {
  void events.unsubscribeNode(nodeId)
}

function onClear(): void {
  events.clearRows()
}
</script>

<template>
  <div class="event-view">
    <div v-if="!connection.isConnected" class="panel-hint">
      请先连接 OPC UA 服务器
    </div>

    <template v-else>
      <div class="toolbar">
        <button
          type="button"
          class="btn btn-subscribe"
          :disabled="events.busy"
          @click="onSubscribeServer"
        >
          订阅 Server 事件源
        </button>
        <button
          v-if="addressSpace.selectedNodeId"
          type="button"
          class="btn btn-subscribe"
          :disabled="events.busy || !events.canSubscribeSelectedEvents"
          :title="
            events.canSubscribeSelectedEvents
              ? '订阅当前选中节点'
              : '当前节点 EventNotifier 未启用 SubscribeToEvents'
          "
          @click="onSubscribeSelected"
        >
          订阅选中节点
        </button>
        <button type="button" class="btn btn-clear" @click="onClear">
          清空列表
        </button>
        <label class="auto-scroll">
          <input v-model="events.autoScroll" type="checkbox" />
          新事件置顶
        </label>
      </div>

      <div v-if="events.statusHint" class="status-hint">
        {{ events.statusHint }}
      </div>

      <div v-if="events.subscribedNodeIds.length > 0" class="subscription-list">
        <span class="sub-label">已订阅:</span>
        <span
          v-for="nodeId in events.subscribedNodeIds"
          :key="nodeId"
          class="sub-chip"
        >
          {{ nodeId }}
          <button
            type="button"
            class="chip-remove"
            title="取消订阅"
            @click="onUnsubscribe(nodeId)"
          >
            ×
          </button>
        </span>
      </div>

      <div v-if="events.hasSubscriptions && events.rows.length === 0" class="empty-hint">
        订阅已建立，暂无事件通知。当前 vulcan_server 尚未发出 OPC UA 业务事件
        （G-V-09）；待服务端启用 EventNotifier / triggerEvent 后将在此显示。
      </div>

      <div v-else-if="!events.hasSubscriptions" class="empty-hint">
        在 Attributes 面板点击「订阅事件」，或使用上方「订阅 Server 事件源」。
      </div>

      <div ref="tableWrap" class="table-wrap">
        <table v-if="events.rows.length > 0" class="event-table">
          <thead>
            <tr>
              <th>收到时间</th>
              <th>Event Time</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Source</th>
              <th>EventType</th>
              <th>源节点</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in events.rows" :key="row.id">
              <td class="col-time">{{ row.receivedAt }}</td>
              <td class="col-time">{{ row.time }}</td>
              <td class="col-severity">{{ row.severity }}</td>
              <td class="col-message">{{ row.message }}</td>
              <td class="col-source">{{ row.sourceName }}</td>
              <td class="col-type">{{ row.eventType }}</td>
              <td class="col-node" :title="row.nodeId">{{ row.label }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.event-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 0.45rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.25rem 0.6rem;
  border: 1px solid transparent;
  font-size: 0.7rem;
}

.btn-subscribe {
  background: #2a2448;
  color: #e8dcff;
  border-color: #6b52a8;
}

.btn-subscribe:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-clear {
  background: var(--bg-inset);
  border-color: var(--border-strong);
  color: var(--text-dim);
}

.auto-scroll {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  color: var(--text-dim);
  margin-left: auto;
}

.status-hint {
  font-size: 0.75rem;
  color: var(--accent);
}

.subscription-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.68rem;
}

.sub-label {
  color: var(--text-muted);
}

.sub-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.35rem;
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: 2px;
  font-family: var(--font-mono);
  color: var(--cyan);
}

.chip-remove {
  padding: 0 0.15rem;
  border: none;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  line-height: 1;
}

.chip-remove:hover {
  color: var(--bad);
}

.empty-hint {
  font-size: 0.75rem;
  color: var(--text-dim);
  font-style: italic;
  line-height: 1.4;
}

.panel-hint {
  margin: 0;
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.82rem;
}

.table-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  background: var(--bg-inset);
}

.event-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.event-table th,
.event-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.32rem 0.4rem;
  text-align: left;
  vertical-align: top;
}

.event-table tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.015);
}

.event-table th {
  position: sticky;
  top: 0;
  background: var(--bg-table-head);
  color: var(--accent);
  font-weight: 700;
  z-index: 1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.62rem;
}

.col-time {
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-dim);
}

.col-severity {
  white-space: nowrap;
  font-family: var(--font-mono);
  color: #ffb347;
}

.col-message {
  word-break: break-word;
  max-width: 14rem;
}

.col-source,
.col-type {
  word-break: break-word;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.col-node {
  white-space: nowrap;
  font-family: var(--font-mono);
  color: var(--cyan);
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
