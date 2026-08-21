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

import { opcuaClientService } from './client'
import type { NodeInfo } from './types'

/** OPC UA 标准 RootFolder */
export const ROOT_FOLDER_NODE_ID = 'i=84'

export async function browseChildren(nodeId: string): Promise<NodeInfo[]> {
  const session = opcuaClientService.getSession()

  const description = new BrowseDescription({
    nodeId: coerceNodeId(nodeId),
    browseDirection: BrowseDirection.Forward,
    referenceTypeId: coerceNodeId(`i=${ReferenceTypeIds.HierarchicalReferences}`),
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

import { statusIsBad } from './status'
