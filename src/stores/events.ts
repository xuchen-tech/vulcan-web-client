import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import {
  DEFAULT_EVENT_SOURCE_NODE_ID,
  canSubscribeToEvents,
  parseEventNotifierLevel,
} from '@/opcua/event-parse'
import { eventSubscriptionManager } from '@/opcua/events'
import type { EventRow, MiddlePanelTab } from '@/opcua/types'
import { logActionError, toErrorMessage } from '@/shared/error-message'

import { useAddressSpaceStore } from './address-space'
import { useConnectionStore } from './connection'
import { useLogStore } from './log'
import { useNodeDetailStore } from './node-detail'

const MAX_EVENT_ROWS = 500

export const useEventsStore = defineStore('events', () => {
  const rows = ref<EventRow[]>([])
  const subscribedNodeIds = ref<string[]>([])
  const busy = ref(false)
  const statusHint = ref<string | null>(null)
  const middlePanelTab = ref<MiddlePanelTab>('data-access')
  const autoScroll = ref(true)

  let nextId = 1
  let stopWatch: (() => void) | null = null

  function init(): void {
    if (stopWatch) {
      return
    }

    eventSubscriptionManager.setEventHandler((event) => {
      rows.value.unshift({
        id: nextId++,
        receivedAt: new Date().toLocaleString(),
        ...event,
      })
      if (rows.value.length > MAX_EVENT_ROWS) {
        rows.value.splice(MAX_EVENT_ROWS)
      }
    })

    eventSubscriptionManager.setErrorHandler((nodeId, err) => {
      useLogStore().warn(`事件订阅错误 (${nodeId}): ${toErrorMessage(err)}`)
    })

    const connection = useConnectionStore()
    stopWatch = watch(
      () => connection.isConnected,
      (connected) => {
        if (!connected) {
          void dispose()
        }
      },
    )
  }

  async function dispose(): Promise<void> {
    await eventSubscriptionManager.dispose()
    rows.value = []
    subscribedNodeIds.value = []
    busy.value = false
    statusHint.value = null
  }

  function syncSubscribedNodeIds(): void {
    subscribedNodeIds.value = eventSubscriptionManager.getSubscribedNodeIds()
  }

  function openEventView(): void {
    middlePanelTab.value = 'events'
  }

  function clearRows(): void {
    rows.value = []
  }

  const selectedEventNotifierText = computed(
    () => useNodeDetailStore().eventNotifierText,
  )

  const canSubscribeSelectedEvents = computed(() =>
    canSubscribeToEvents(parseEventNotifierLevel(selectedEventNotifierText.value)),
  )

  async function subscribeNode(
    nodeId: string,
    label?: string,
    options: { focus?: boolean } = {},
  ): Promise<boolean> {
    if (eventSubscriptionManager.isSubscribed(nodeId)) {
      statusHint.value = `已订阅事件: ${label ?? nodeId}`
      if (options.focus !== false) {
        openEventView()
      }
      return true
    }

    const log = useLogStore()
    busy.value = true
    statusHint.value = null

    try {
      await eventSubscriptionManager.subscribe(nodeId, label)
      syncSubscribedNodeIds()
      log.ok(`已订阅事件 ${label ?? nodeId}`)
      if (options.focus !== false) {
        openEventView()
      }
      return true
    } catch (err) {
      statusHint.value = logActionError(
        log,
        `订阅事件失败 (${nodeId})`,
        err,
      )
      return false
    } finally {
      busy.value = false
    }
  }

  async function unsubscribeNode(nodeId: string): Promise<void> {
    const log = useLogStore()
    busy.value = true
    try {
      await eventSubscriptionManager.unsubscribe(nodeId)
      syncSubscribedNodeIds()
      log.info(`已取消事件订阅 ${nodeId}`)
    } catch (err) {
      logActionError(log, `取消事件订阅失败 (${nodeId})`, err)
    } finally {
      busy.value = false
    }
  }

  async function subscribeSelectedNode(): Promise<void> {
    const addressSpace = useAddressSpaceStore()
    const nodeId = addressSpace.selectedNodeId
    if (!nodeId) {
      statusHint.value = '请先在地址空间选择节点'
      return
    }

    if (!canSubscribeSelectedEvents.value) {
      statusHint.value = '当前节点 EventNotifier 未启用 SubscribeToEvents'
      useLogStore().warn(`节点 ${nodeId} 不可订阅事件（EventNotifier=0）`)
      return
    }

    const label = addressSpace.getSelectedNode()?.displayName ?? nodeId
    await subscribeNode(nodeId, label)
  }

  async function subscribeServerDefault(): Promise<void> {
    await subscribeNode(DEFAULT_EVENT_SOURCE_NODE_ID, 'Server')
  }

  const hasSubscriptions = computed(() => subscribedNodeIds.value.length > 0)

  return {
    rows,
    subscribedNodeIds,
    busy,
    statusHint,
    middlePanelTab,
    autoScroll,
    canSubscribeSelectedEvents,
    hasSubscriptions,
    init,
    dispose,
    openEventView,
    clearRows,
    subscribeNode,
    unsubscribeNode,
    subscribeSelectedNode,
    subscribeServerDefault,
  }
})
