import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { AttributeIds } from '@wsopcua/wsopcua'

import { readAttributes } from '@/opcua/attributes'
import { readReferences } from '@/opcua/references'
import { readValue, writeValue } from '@/opcua/readwrite'
import type { AttrRow, RefRow, ValueReadResult } from '@/opcua/types'

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
  const valueBusy = ref(false)

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

  const currentValueText = computed(() => attributeDisplay('Value'))
  const dataTypeHint = computed(() => attributeDisplay('DataType'))
  const valueRankHint = computed(() => parseValueRank(attributeDisplay('ValueRank')))
  const canReadWriteValue = computed(
    () => useAddressSpaceStore().isSelectedVariable,
  )

  function attributeDisplay(name: string): string | undefined {
    const row = attributes.value.find((item) => item.attributeName === name)
    return row?.displayValue
  }

  function parseValueRank(text: string | undefined): number | undefined {
    if (text == null || text === '—' || text === '<null>') {
      return undefined
    }
    const parsed = Number(text)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  function applyValueReadResult(result: ValueReadResult): void {
    const index = attributes.value.findIndex(
      (row) => row.attributeId === AttributeIds.Value,
    )
    if (index < 0) {
      return
    }

    attributes.value[index] = {
      attributeId: AttributeIds.Value,
      attributeName: 'Value',
      displayValue: result.displayValue,
      statusCode: result.statusCode,
      isError: result.isError,
      detail: result.detail || undefined,
    }
  }

  async function readSelectedValue(): Promise<void> {
    const addressSpace = useAddressSpaceStore()
    const nodeId = addressSpace.selectedNodeId
    if (!nodeId) {
      return
    }

    const log = useLogStore()
    valueBusy.value = true

    try {
      const result = await readValue(nodeId)
      applyValueReadResult(result)
      if (result.isError) {
        log.err(`读 Value ${nodeId}: ${result.statusCode}`)
      } else {
        log.ok(
          `读 Value ${nodeId} = ${result.displayValue} (${result.statusCode})`,
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.err(`读 Value 失败 (${nodeId}): ${message}`)
    } finally {
      valueBusy.value = false
    }
  }

  async function writeSelectedValue(inputText: string): Promise<boolean> {
    const addressSpace = useAddressSpaceStore()
    const nodeId = addressSpace.selectedNodeId
    if (!nodeId) {
      return false
    }

    const log = useLogStore()
    valueBusy.value = true

    try {
      const result = await writeValue(nodeId, inputText, {
        dataTypeNodeId: dataTypeHint.value,
        valueRank: valueRankHint.value,
      })

      if (!result.writeOk) {
        log.err(
          `写 Value ${nodeId} = ${result.writtenValue} -> ${result.writeStatusCode}`,
        )
        return false
      }

      log.ok(
        `写 Value ${nodeId} = ${result.writtenValue} -> ${result.writeStatusCode}`,
      )

      if (result.readBack) {
        applyValueReadResult(result.readBack)
        log.ok(`读回 ${nodeId} = ${result.readBack.displayValue}`)
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.err(`写 Value 失败 (${nodeId}): ${message}`)
      return false
    } finally {
      valueBusy.value = false
    }
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
    valueBusy,
    currentValueText,
    dataTypeHint,
    valueRankHint,
    canReadWriteValue,
    clear,
    loadForNode,
    readSelectedValue,
    writeSelectedValue,
    init,
    dispose,
  }
})
