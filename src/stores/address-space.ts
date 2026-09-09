import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { NodeClass } from '@wsopcua/wsopcua/data-model'

import {
  browseChildren,
  browseHierarchicalPath,
  ROOT_FOLDER_NODE_ID,
  type BrowseMode,
} from '@/opcua/browse'
import { nodeIdsEqual } from '@/opcua/browse-mode'
import type { NodeInfo } from '@/opcua/types'
import { logActionError } from '@/shared/error-message'

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
  const locating = ref(false)
  const error = ref<string | null>(null)
  const browseMode = ref<BrowseMode>('hierarchical')

  function reset(): void {
    root.value = null
    selectedNodeId.value = null
    loading.value = false
    locating.value = false
    error.value = null
    browseMode.value = 'hierarchical'
  }

  async function loadRoot(): Promise<void> {
    const log = useLogStore()
    loading.value = true
    error.value = null

    try {
      log.info(
        browseMode.value === 'all'
          ? '浏览地址空间 Root（全部引用）…'
          : '浏览地址空间 Root…',
      )
      const children = await browseChildren(ROOT_FOLDER_NODE_ID, browseMode.value)
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
      error.value = logActionError(log, '浏览地址空间失败', err)
      root.value = null
    } finally {
      loading.value = false
    }
  }

  async function setBrowseMode(mode: BrowseMode): Promise<void> {
    if (browseMode.value === mode) {
      return
    }
    browseMode.value = mode
    const selected = selectedNodeId.value
    await loadRoot()
    if (selected) {
      await locateNode(selected)
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
      const children = await browseChildren(nodeId, browseMode.value)
      node.children = children.map(infoToTreeNode)
      node.loaded = true
      node.expanded = true
      node.isLeaf = children.length === 0
      node.hasChildren = children.length > 0
    } catch (err) {
      error.value = logActionError(log, `浏览 ${nodeId} 失败`, err)
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

  async function locateNode(nodeId: string): Promise<boolean> {
    const log = useLogStore()
    locating.value = true

    try {
      if (!root.value) {
        await loadRoot()
      }
      if (!root.value) {
        return false
      }

      const existingPath = findPath(root.value, nodeId)
      if (existingPath) {
        for (const node of existingPath) {
          node.expanded = true
        }
        selectNode(existingPath[existingPath.length - 1].nodeId)
        return true
      }

      const chain = await browseHierarchicalPath(nodeId)
      for (const ancestorId of chain) {
        if (nodeIdsEqual(ancestorId, nodeId)) {
          continue
        }
        await expandNode(ancestorId)
      }

      const located = findNode(root.value, nodeId)
      if (located) {
        const path = findPath(root.value, located.nodeId)
        if (path) {
          for (const node of path) {
            node.expanded = true
          }
        }
        selectNode(located.nodeId)
        log.ok(`已在地址空间定位 ${located.displayName}`)
        return true
      }

      selectNode(nodeId)
      log.warn(
        `已选中 ${nodeId}，但当前树未包含该节点（可切换“全部引用”后再试）`,
      )
      return false
    } catch (err) {
      logActionError(log, `定位节点 ${nodeId} 失败`, err)
      selectNode(nodeId)
      return false
    } finally {
      locating.value = false
    }
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

  function isMethodNode(nodeClass: NodeClass | undefined): boolean {
    return nodeClass === NodeClass.Method
  }

  const isSelectedVariable = computed(() =>
    isVariableNode(getSelectedNode()?.nodeClass),
  )

  const isSelectedMethod = computed(() =>
    isMethodNode(getSelectedNode()?.nodeClass),
  )

  return {
    root,
    selectedNodeId,
    loading,
    locating,
    error,
    browseMode,
    reset,
    loadRoot,
    setBrowseMode,
    expandNode,
    collapseNode,
    toggleNode,
    selectNode,
    locateNode,
    getSelectedNode,
    isVariableNode,
    isMethodNode,
    isSelectedVariable,
    isSelectedMethod,
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
  if (nodeIdsEqual(node.nodeId, nodeId)) {
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

function findPath(node: TreeNode, nodeId: string): TreeNode[] | null {
  if (nodeIdsEqual(node.nodeId, nodeId)) {
    return [node]
  }
  for (const child of node.children) {
    const nested = findPath(child, nodeId)
    if (nested) {
      return [node, ...nested]
    }
  }
  return null
}
