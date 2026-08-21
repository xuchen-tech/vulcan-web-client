import {
  BrowseDescription,
  BrowseDirection,
  BrowseResultMask,
  ReferenceTypeIds,
  browseAll,
  coerceNodeId,
  type ReferenceDescription,
} from '@wsopcua/wsopcua'

import { opcuaClientService } from './client'
import { nodeClassName } from './format'
import { statusIsBad } from './status'
import type { RefRow } from './types'

const REFERENCE_TYPE_NAMES: Record<number, string> = {
  [ReferenceTypeIds.References]: 'References',
  [ReferenceTypeIds.NonHierarchicalReferences]: 'NonHierarchicalReferences',
  [ReferenceTypeIds.HierarchicalReferences]: 'HierarchicalReferences',
  [ReferenceTypeIds.HasChild]: 'HasChild',
  [ReferenceTypeIds.Organizes]: 'Organizes',
  [ReferenceTypeIds.HasEventSource]: 'HasEventSource',
  [ReferenceTypeIds.HasModellingRule]: 'HasModellingRule',
  [ReferenceTypeIds.HasEncoding]: 'HasEncoding',
  [ReferenceTypeIds.HasDescription]: 'HasDescription',
  [ReferenceTypeIds.HasTypeDefinition]: 'HasTypeDefinition',
  [ReferenceTypeIds.GeneratesEvent]: 'GeneratesEvent',
  [ReferenceTypeIds.Aggregates]: 'Aggregates',
  [ReferenceTypeIds.HasSubtype]: 'HasSubtype',
  [ReferenceTypeIds.HasProperty]: 'HasProperty',
  [ReferenceTypeIds.HasComponent]: 'HasComponent',
  [ReferenceTypeIds.HasNotifier]: 'HasNotifier',
  [ReferenceTypeIds.HasOrderedComponent]: 'HasOrderedComponent',
  [ReferenceTypeIds.FromState]: 'FromState',
  [ReferenceTypeIds.ToState]: 'ToState',
  [ReferenceTypeIds.HasCause]: 'HasCause',
  [ReferenceTypeIds.HasEffect]: 'HasEffect',
  [ReferenceTypeIds.HasHistoricalConfiguration]: 'HasHistoricalConfiguration',
}

export async function readReferences(nodeId: string): Promise<RefRow[]> {
  const session = opcuaClientService.getSession()

  const description = new BrowseDescription({
    nodeId: coerceNodeId(nodeId),
    browseDirection: BrowseDirection.Both,
    referenceTypeId: coerceNodeId(`i=${ReferenceTypeIds.References}`),
    includeSubtypes: true,
    nodeClassMask: 0,
    resultMask: BrowseResultMask.All,
  })

  const results = await browseAll(session, description)
  const browseResult = results[0]

  if (!browseResult) {
    throw new Error(`Browse references ${nodeId}: 无结果`)
  }

  if (statusIsBad(browseResult.statusCode)) {
    throw new Error(
      `Browse references ${nodeId}: ${browseResult.statusCode.description ?? browseResult.statusCode.toString()}`,
    )
  }

  return (browseResult.references ?? [])
    .map(referenceToRefRow)
    .sort(compareRefRows)
}

function referenceToRefRow(ref: ReferenceDescription): RefRow {
  const targetNodeId = ref.nodeId.toString()
  const targetBrowseName = ref.browseName?.name?.trim() || targetNodeId

  return {
    referenceType: referenceTypeName(ref.referenceTypeId.toString()),
    isForward: ref.isForward,
    targetBrowseName,
    targetNodeId,
    targetNodeClass: nodeClassName(ref.nodeClass),
    typeDefinition: ref.typeDefinition?.toString() ?? '—',
  }
}

function referenceTypeName(referenceTypeId: string): string {
  const match = /^i=(\d+)$/.exec(referenceTypeId)
  if (match) {
    const id = Number(match[1])
    return REFERENCE_TYPE_NAMES[id] ?? referenceTypeId
  }
  return referenceTypeId
}

function compareRefRows(a: RefRow, b: RefRow): number {
  const dir = Number(b.isForward) - Number(a.isForward)
  if (dir !== 0) {
    return dir
  }
  return a.referenceType.localeCompare(b.referenceType, undefined, {
    sensitivity: 'base',
  })
}
