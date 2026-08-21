import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { readAttributes } from '@/opcua/attributes'
import { readReferences } from '@/opcua/references'
import type { AttrRow, RefRow } from '@/opcua/types'

import { useAddressSpaceStore } from './address-space'
import { useConnectionStore } from './connection'
import { useLogStore } from './log'

export const useNodeDetailStore = defineStore('nodeDetail', () => {
  const attributes = ref<AttrRow[]>([])
  const references = ref<RefRow[]>([])
  const attrsLoading = ref(false)
  const refsLoading = ref(false)
  const attrsError = ref<string | null>(null)
  const refsError = ref<string | null>(null)

  let loadToken = 0
  let stopWatch: (() => void) | null = null

  function clear(): void {
    loadToken += 1
    attributes.value = []
    references.value = []
    attrsLoading.value = false
    refsLoading.value = false
    attrsError.value = null
    refsError.value = null
  }

  async function loadForNode(nodeId: string): Promise<void> {
    const token = ++loadToken
    attrsLoading.value = true
    refsLoading.value = true
    attrsError.value = null
    refsError.value = null
    attributes.value = []
    references.value = []

    const log = useLogStore()
    log.info(`读取节点 ${nodeId} 的属性与引用…`)

    const [attrsResult, refsResult] = await Promise.allSettled([
      readAttributes(nodeId),
      readReferences(nodeId),
    ])

    if (token !== loadToken) {
      return
    }

    if (attrsResult.status === 'fulfilled') {
      attributes.value = attrsResult.value
      attrsError.value = null
    } else {
      const message =
        attrsResult.reason instanceof Error
          ? attrsResult.reason.message
          : String(attrsResult.reason)
      attrsError.value = message
      log.err(`读取属性失败 (${nodeId}): ${message}`)
    }
    attrsLoading.value = false

    if (refsResult.status === 'fulfilled') {
      references.value = refsResult.value
      refsError.value = null
      log.ok(
        `节点 ${nodeId}：${attributes.value.length} 项属性，${references.value.length} 条引用`,
      )
    } else {
      const message =
        refsResult.reason instanceof Error
          ? refsResult.reason.message
          : String(refsResult.reason)
      refsError.value = message
      log.err(`读取引用失败 (${nodeId}): ${message}`)
    }
    refsLoading.value = false
  }

  function init(): void {
    if (stopWatch) {
      return
    }

    const connection = useConnectionStore()
    const addressSpace = useAddressSpaceStore()

    stopWatch = watch(
      () =>
        connection.isConnected
          ? addressSpace.selectedNodeId
          : null,
      (nodeId) => {
        if (nodeId) {
          void loadForNode(nodeId)
        } else {
          clear()
        }
      },
      { immediate: true },
    )
  }

  function dispose(): void {
    stopWatch?.()
    stopWatch = null
    clear()
  }

  return {
    attributes,
    references,
    attrsLoading,
    refsLoading,
    attrsError,
    refsError,
    clear,
    loadForNode,
    init,
    dispose,
  }
})
