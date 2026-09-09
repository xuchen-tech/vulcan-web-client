import {
  BrowseDescription,
  BrowseDirection,
  BrowseResultMask,
  coerceNodeId,
  ReferenceTypeIds,
  browseAll,
  type ReferenceDescription,
} from '@wsopcua/wsopcua'
import { NodeClass } from '@wsopcua/wsopcua/data-model'

import {
  type BrowseMode,
  OBJECTS_FOLDER_NODE_ID,
  ROOT_FOLDER_NODE_ID,
  nodeIdsEqual,
  pickPreferredParentNodeId,
} from './browse-mode'
import { opcuaClientService } from './client'
import { statusIsBad } from './status'
import type { NodeInfo } from './types'

export { ROOT_FOLDER_NODE_ID, type BrowseMode } from './browse-mode'

const MAX_PARENT_WALK = 32

export async function browseChildren(
  nodeId: string,
  mode: BrowseMode = 'hierarchical',
): Promise<NodeInfo[]> {
  const session = opcuaClientService.getSession()

  const description = new BrowseDescription({
    nodeId: coerceNodeId(nodeId),
    browseDirection: BrowseDirection.Forward,
    referenceTypeId: coerceNodeId(
      mode === 'all'
        ? `i=${ReferenceTypeIds.References}`
        : `i=${ReferenceTypeIds.HierarchicalReferences}`,
    ),
    includeSubtypes: true,
    nodeClassMask: 0,
    resultMask: BrowseResultMask.All,
  })

  const results = await browseAll(session, description)
  const browseResult = results[0]

  if (!browseResult) {
    throw new Error(`Browse ${nodeId}: 无结果`)
  }

  if (statusIsBad(browseResult.statusCode)) {
    throw new Error(
      `Browse ${nodeId}: ${browseResult.statusCode.description ?? browseResult.statusCode.toString()}`,
    )
  }

  return (browseResult.references ?? [])
    .filter((ref) => ref.isForward)
    .map(referenceToNodeInfo)
    .sort(compareNodeInfo)
}

export async function browseInverseHierarchical(
  nodeId: string,
): Promise<NodeInfo[]> {
  const session = opcuaClientService.getSession()

  const description = new BrowseDescription({
    nodeId: coerceNodeId(nodeId),
    browseDirection: BrowseDirection.Inverse,
    referenceTypeId: coerceNodeId(`i=${ReferenceTypeIds.HierarchicalReferences}`),
    includeSubtypes: true,
    nodeClassMask: 0,
    resultMask: BrowseResultMask.All,
  })

  const results = await browseAll(session, description)
  const browseResult = results[0]

  if (!browseResult) {
    return []
  }

  if (statusIsBad(browseResult.statusCode)) {
    throw new Error(
      `Browse parents ${nodeId}: ${browseResult.statusCode.description ?? browseResult.statusCode.toString()}`,
    )
  }

  return (browseResult.references ?? [])
    .filter((ref) => !ref.isForward)
    .map(referenceToNodeInfo)
}

/** 从目标沿反向层级引用走到 Root，返回 Root → 目标 的 NodeId 链 */
export async function browseHierarchicalPath(nodeId: string): Promise<string[]> {
  const chain: string[] = [nodeId]
  let current = nodeId

  for (let step = 0; step < MAX_PARENT_WALK; step++) {
    if (nodeIdsEqual(current, ROOT_FOLDER_NODE_ID)) {
      break
    }

    const parents = await browseInverseHierarchical(current)
    const parentId = pickPreferredParentNodeId(
      parents.map((item) => item.nodeId),
    )
    if (!parentId) {
      break
    }
    if (chain.some((id) => nodeIdsEqual(id, parentId))) {
      break
    }

    chain.push(parentId)
    current = parentId
  }

  if (!chain.some((id) => nodeIdsEqual(id, ROOT_FOLDER_NODE_ID))) {
    chain.push(ROOT_FOLDER_NODE_ID)
  }

  return chain.reverse()
}

export { OBJECTS_FOLDER_NODE_ID, nodeIdsEqual }

function referenceToNodeInfo(ref: ReferenceDescription): NodeInfo {
  const nodeId = ref.nodeId.toString()
  const browseName = ref.browseName?.name?.trim() || nodeId
  const displayName =
    ref.displayName?.text?.trim() || ref.browseName?.name?.trim() || nodeId

  return {
    nodeId,
    browseName,
    displayName,
    nodeClass: ref.nodeClass as NodeInfo['nodeClass'],
    typeDefinition: ref.typeDefinition?.toString(),
    hasChildren: nodeClassMayHaveChildren(ref.nodeClass),
  }
}

function nodeClassMayHaveChildren(nodeClass: NodeClass): boolean {
  switch (nodeClass) {
    case NodeClass.Object:
    case NodeClass.View:
    case NodeClass.ObjectType:
    case NodeClass.VariableType:
    case NodeClass.DataType:
    case NodeClass.ReferenceType:
      return true
    default:
      return false
  }
}

function compareNodeInfo(a: NodeInfo, b: NodeInfo): number {
  return a.displayName.localeCompare(b.displayName, undefined, {
    sensitivity: 'base',
  })
}
