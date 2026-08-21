import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { writeValue } from '@/opcua/readwrite'
import { subscriptionManager } from '@/opcua/subscription'
import type { MonitorRow, SubscriptionSettings } from '@/opcua/types'
import { logActionError, toErrorMessage } from '@/shared/error-message'

import { useAddressSpaceStore } from './address-space'
import { useConnectionStore } from './connection'
import { useLogStore } from './log'
import { useNodeDetailStore } from './node-detail'

export const useMonitorStore = defineStore('monitor', () => {
  const rows = ref<MonitorRow[]>([])
  const publishingInterval = ref(1000)
  const samplingInterval = ref(1000)
  const queueSize = ref(1)
  const busy = ref(false)
  const degraded = ref(false)
  const writeDrafts = ref<Record<string, string>>({})
  const statusHint = ref<string | null>(null)

  let stopWatch: (() => void) | null = null

  function rowIndex(nodeId: string): number {
    return rows.value.findIndex((row) => row.nodeId === nodeId)
  }

  function patchRow(nodeId: string, patch: Partial<MonitorRow>): void {
    const index = rowIndex(nodeId)
    if (index < 0) {
      return
    }
    rows.value[index] = { ...rows.value[index], ...patch }
  }

  function init(): void {
    if (stopWatch) {
      return
    }

    subscriptionManager.setUpdateHandler((nodeId, update) => {
      patchRow(nodeId, update)
    })

    subscriptionManager.setPollErrorHandler((nodeId, err) => {
      useLogStore().warn(`轮询 read 失败 (${nodeId}): ${toErrorMessage(err)}`)
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
    await subscriptionManager.dispose()
    rows.value = []
    writeDrafts.value = {}
    degraded.value = false
    busy.value = false
  }

  function getWriteDraft(nodeId: string): string {
    return writeDrafts.value[nodeId] ?? ''
  }

  function setWriteDraft(nodeId: string, value: string): void {
    writeDrafts.value = { ...writeDrafts.value, [nodeId]: value }
  }

  async function addNode(nodeId: string, label?: string): Promise<void> {
    if (rows.value.some((row) => row.nodeId === nodeId)) {
      const message = `已在监视表: ${label ?? nodeId}`
      statusHint.value = message
      useLogStore().warn(message)
      return
    }

    const log = useLogStore()
    busy.value = true
    statusHint.value = `正在加入监视: ${label ?? nodeId}…`

    try {
      const initial = await subscriptionManager.addMonitor(nodeId)
      rows.value.push({
        nodeId,
        label: label ?? nodeId,
        value: initial.displayValue,
        dataType: extractDetailField(initial.detail, 'DataType'),
        sourceTimestamp: extractDetailField(initial.detail, 'SourceTs'),
        serverTimestamp: extractDetailField(initial.detail, 'ServerTs'),
        statusCode: initial.statusCode,
        isError: initial.isError,
        writeBusy: false,
      })
      writeDrafts.value[nodeId] = initial.isError ? '' : initial.displayValue
      degraded.value = subscriptionManager.isDegraded()
      if (degraded.value) {
        statusHint.value = '已加入监视（订阅不可用，降级为轮询 read）'
        log.warn('订阅不可用，监视表已降级为轮询 read')
      } else {
        statusHint.value = `已加入监视: ${label ?? nodeId}`
        log.ok(`已加入监视: ${nodeId}`)
      }
    } catch (err) {
      const message = logActionError(log, `加入监视失败 (${nodeId})`, err)
      statusHint.value = `加入监视失败: ${message}`
    } finally {
      busy.value = false
    }
  }

  async function addSelectedNode(): Promise<void> {
    const addressSpace = useAddressSpaceStore()
    const node = addressSpace.getSelectedNode()
    if (!node) {
      statusHint.value = '请先在地址空间选择节点'
      useLogStore().warn('请先在地址空间选择节点')
      return
    }
    if (!addressSpace.isVariableNode(node.nodeClass)) {
      statusHint.value = '仅 Variable 节点可加入监视表'
      useLogStore().warn('仅 Variable 节点可加入监视表')
      return
    }

    await addNode(node.nodeId, node.displayName)
  }

  async function removeRow(nodeId: string): Promise<void> {
    busy.value = true
    const log = useLogStore()

    try {
      await subscriptionManager.removeMonitor(nodeId)
      rows.value = rows.value.filter((row) => row.nodeId !== nodeId)
      const { [nodeId]: _removed, ...rest } = writeDrafts.value
      writeDrafts.value = rest
      log.ok(`已移除监视: ${nodeId}`)
    } catch (err) {
      logActionError(log, `移除监视失败 (${nodeId})`, err)
    } finally {
      busy.value = false
    }
  }

  async function writeRow(nodeId: string, inputText: string): Promise<void> {
    if (rowIndex(nodeId) < 0) {
      return
    }

    const trimmed = inputText.trim()
    if (!trimmed) {
      useLogStore().warn('写入值不能为空')
      return
    }

    const log = useLogStore()
    const nodeDetail = useNodeDetailStore()
    const addressSpace = useAddressSpaceStore()
    const writeOptions =
      addressSpace.selectedNodeId === nodeId
        ? {
            dataTypeNodeId: nodeDetail.dataTypeHint,
            valueRank: nodeDetail.valueRankHint,
          }
        : {}

    patchRow(nodeId, { writeBusy: true })
    busy.value = true

    try {
      const result = await writeValue(nodeId, trimmed, writeOptions)
      if (!result.writeOk) {
        log.err(
          `监视写 ${nodeId} = ${trimmed} -> ${result.writeStatusCode}`,
        )
        return
      }

      log.ok(`监视写 ${nodeId} = ${trimmed} -> ${result.writeStatusCode}`)
      if (result.readBack) {
        patchRow(nodeId, {
          value: result.readBack.displayValue,
          dataType: extractDetailField(result.readBack.detail, 'DataType'),
          sourceTimestamp: extractDetailField(result.readBack.detail, 'SourceTs'),
          serverTimestamp: extractDetailField(result.readBack.detail, 'ServerTs'),
          statusCode: result.readBack.statusCode,
          isError: result.readBack.isError,
        })
        writeDrafts.value[nodeId] = result.readBack.isError
          ? trimmed
          : result.readBack.displayValue
      }
    } catch (err) {
      logActionError(log, `监视写失败 (${nodeId})`, err)
    } finally {
      patchRow(nodeId, { writeBusy: false })
      busy.value = false
    }
  }

  async function applySettings(): Promise<void> {
    const settings: SubscriptionSettings = {
      publishingInterval: publishingInterval.value,
      samplingInterval: samplingInterval.value,
      queueSize: queueSize.value,
    }

    if (
      settings.publishingInterval < 100 ||
      settings.samplingInterval < 100 ||
      settings.queueSize < 1
    ) {
      useLogStore().warn('发布/采样间隔 >= 100ms，队列 >= 1')
      return
    }

    busy.value = true
    const log = useLogStore()

    try {
      await subscriptionManager.updateSettings(settings)
      degraded.value = subscriptionManager.isDegraded()
      log.ok(
        `监视参数已更新（发布 ${settings.publishingInterval}ms，采样 ${settings.samplingInterval}ms，队列 ${settings.queueSize}）`,
      )
    } catch (err) {
      logActionError(log, '更新监视参数失败', err)
    } finally {
      busy.value = false
    }
  }

  const hasRows = computed(() => rows.value.length > 0)

  return {
    rows,
    publishingInterval,
    samplingInterval,
    queueSize,
    busy,
    degraded,
    statusHint,
    hasRows,
    init,
    dispose,
    getWriteDraft,
    setWriteDraft,
    addNode,
    addSelectedNode,
    removeRow,
    writeRow,
    applySettings,
  }
})

function extractDetailField(detail: string, key: string): string {
  const match = new RegExp(`${key}:\\s*([^|]+)`).exec(detail)
  return match?.[1]?.trim() ?? '—'
}
