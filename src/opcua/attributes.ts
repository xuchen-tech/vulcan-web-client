import {
  AttributeIds,
  ReadValueId,
  coerceNodeId,
  type DataValue,
} from '@wsopcua/wsopcua'

import { opcuaClientService } from './client'
import {
  accessLevelToText,
  formatDataValue,
  nodeClassName,
  variantToDisplay,
} from './format'
import { statusCodeToText, statusIsBad } from './status'
import type { AttrRow } from './types'

interface AttributeSpec {
  id: AttributeIds
  name: string
}

const NODE_ATTRIBUTES: AttributeSpec[] = [
  { id: AttributeIds.NodeId, name: 'NodeId' },
  { id: AttributeIds.NodeClass, name: 'NodeClass' },
  { id: AttributeIds.BrowseName, name: 'BrowseName' },
  { id: AttributeIds.DisplayName, name: 'DisplayName' },
  { id: AttributeIds.Description, name: 'Description' },
  { id: AttributeIds.DataType, name: 'DataType' },
  { id: AttributeIds.ValueRank, name: 'ValueRank' },
  { id: AttributeIds.AccessLevel, name: 'AccessLevel' },
  { id: AttributeIds.UserAccessLevel, name: 'UserAccessLevel' },
  { id: AttributeIds.MinimumSamplingInterval, name: 'MinimumSamplingInterval' },
  { id: AttributeIds.Historizing, name: 'Historizing' },
  { id: AttributeIds.Value, name: 'Value' },
  { id: AttributeIds.EventNotifier, name: 'EventNotifier' },
  { id: AttributeIds.Executable, name: 'Executable' },
  { id: AttributeIds.UserExecutable, name: 'UserExecutable' },
]

export async function readAttributes(nodeId: string): Promise<AttrRow[]> {
  const session = opcuaClientService.getSession()
  const nodesToRead = NODE_ATTRIBUTES.map(
    (spec) =>
      new ReadValueId({
        nodeId: coerceNodeId(nodeId),
        attributeId: spec.id,
      }),
  )

  const response = await session.readP(nodesToRead)
  const dataValues = Array.isArray(response.value)
    ? response.value
    : [response.value]

  return NODE_ATTRIBUTES.map((spec, index) =>
    dataValueToAttrRow(spec, dataValues[index]),
  )
}

function dataValueToAttrRow(
  spec: AttributeSpec,
  dataValue: DataValue | undefined,
): AttrRow {
  if (!dataValue || !dataValue.statusCode) {
    return {
      attributeId: spec.id,
      attributeName: spec.name,
      displayValue: '—',
      statusCode: 'BadNoData',
      isError: true,
    }
  }

  const statusText = statusCodeToText(dataValue.statusCode)
  const isError = statusIsBad(dataValue.statusCode)

  if (isError) {
    return {
      attributeId: spec.id,
      attributeName: spec.name,
      displayValue: statusText,
      statusCode: statusText,
      isError: true,
    }
  }

  if (spec.id === AttributeIds.Value) {
    const formatted = formatDataValue(dataValue)
    return {
      attributeId: spec.id,
      attributeName: spec.name,
      displayValue: formatted.displayValue,
      statusCode: statusText,
      isError: false,
      detail: formatted.detail,
    }
  }

  return {
    attributeId: spec.id,
    attributeName: spec.name,
    displayValue: formatAttributeValue(spec.id, dataValue),
    statusCode: statusText,
    isError: false,
  }
}

function formatAttributeValue(
  attributeId: AttributeIds,
  dataValue: DataValue,
): string {
  const variant = dataValue.value
  if (!variant) {
    return '<null>'
  }

  switch (attributeId) {
    case AttributeIds.NodeClass:
      return nodeClassName(Number(variant.value))
    case AttributeIds.AccessLevel:
    case AttributeIds.UserAccessLevel:
      return accessLevelToText(Number(variant.value))
    default:
      return variantToDisplay(variant)
  }
}
