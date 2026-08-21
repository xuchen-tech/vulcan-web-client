import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { NodeClass } from '@wsopcua/wsopcua/data-model'

import { browseChildren, ROOT_FOLDER_NODE_ID } from '@/opcua/browse'
import type { NodeInfo } from '@/opcua/types'

import { useLogStore } from './log'

export interface TreeNode extends NodeInfo {
  loaded: boolean
  expanded: boolean
  loading: boolean
  isLeaf: boolean
  children: TreeNode[]
}

export const useAddressSpaceStore = defineStore('addressSpace', () => {
  const root = ref<TreeNode | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function reset(): void {
    root.value = null
    selectedNodeId.value = null
    loading.value = false
    error.value = null
  }

  async function loadRoot(): Promise<void> {
    const log = useLogStore()
    loading.value = true
    error.value = null

    try {
      log.info('浏览地址空间 Root…')
      const children = await browseChildren(ROOT_FOLDER_NODE_ID)
      root.value = {
        nodeId: ROOT_FOLDER_NODE_ID,
        browseName: 'Root',
        displayName: 'Root',
        nodeClass: NodeClass.Object,
        loaded: true,
        expanded: true,
        loading: false,
        isLeaf: children.length === 0,
        hasChildren: children.length > 0,
        children: children.map(infoToTreeNode),
      }
      log.ok(`地址空间已加载（Root 下 ${children.length} 项）`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      root.value = null
      log.err(`浏览地址空间失败: ${message}`)
    } finally {
      loading.value = false
    }
  }

  async function expandNode(nodeId: string): Promise<void> {
    const node = findNode(root.value, nodeId)
    if (!node || node.loading) {
      return
    }

    if (node.loaded) {
      node.expanded = true
      return
    }

    const log = useLogStore()
    node.loading = true
    error.value = null

    try {
      const children = await browseChildren(nodeId)
      node.children = children.map(infoToTreeNode)
      node.loaded = true
      node.expanded = true
      node.isLeaf = children.length === 0
      node.hasChildren = children.length > 0
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      log.err(`浏览 ${nodeId} 失败: ${message}`)
    } finally {
      node.loading = false
    }
  }

  function collapseNode(nodeId: string): void {
    const node = findNode(root.value, nodeId)
    if (node) {
      node.expanded = false
    }
  }

  async function toggleNode(nodeId: string): Promise<void> {
    const node = findNode(root.value, nodeId)
    if (!node || node.isLeaf) {
      return
    }

    if (node.expanded) {
      collapseNode(nodeId)
      return
    }

    await expandNode(nodeId)
  }

  function selectNode(nodeId: string): void {
    selectedNodeId.value = nodeId
  }

  function getSelectedNode(): TreeNode | null {
    if (!selectedNodeId.value) {
      return null
    }
    return findNode(root.value, selectedNodeId.value)
  }

  function isVariableNode(nodeClass: NodeClass | undefined): boolean {
    return nodeClass === NodeClass.Variable
  }

  const isSelectedVariable = computed(() =>
    isVariableNode(getSelectedNode()?.nodeClass),
  )

  return {
    root,
    selectedNodeId,
    loading,
    error,
    reset,
    loadRoot,
    expandNode,
    collapseNode,
    toggleNode,
    selectNode,
    getSelectedNode,
    isVariableNode,
    isSelectedVariable,
  }
})

function infoToTreeNode(info: NodeInfo): TreeNode {
  return {
    ...info,
    loaded: false,
    expanded: false,
    loading: false,
    isLeaf: info.hasChildren === false,
    children: [],
  }
}

function findNode(node: TreeNode | null, nodeId: string): TreeNode | null {
  if (!node) {
    return null
  }
  if (node.nodeId === nodeId) {
    return node
  }
  for (const child of node.children) {
    const found = findNode(child, nodeId)
    if (found) {
      return found
    }
  }
  return null
}
