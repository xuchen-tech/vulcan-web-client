import {
  Argument,
  BrowseDescription,
  BrowseDirection,
  BrowseResultMask,
  CallMethodRequest,
  DataType,
  ReferenceTypeIds,
  Variant,
  VariantArrayType,
  browseAll,
  coerceNodeId,
  type DataValue,
} from '@wsopcua/wsopcua'
import { NodeClass } from '@wsopcua/wsopcua/data-model'

import { opcuaClientService } from './client'
import { variantToDisplay } from './format'
import {
  extensionObjectToArgument,
  rawArgumentToDef,
} from './method-parse'
import { parseWriteInput } from './readwrite-parse'
import { resolveDataValueStatus, statusCodeToText, statusIsBad } from './status'
import type {
  MethodArgumentDef,
  MethodCallResult,
  MethodSignature,
} from './types'

const METHOD_PROPERTY_NAMES = ['InputArguments', 'OutputArguments'] as const

type MethodPropertyName = (typeof METHOD_PROPERTY_NAMES)[number]

export async function readMethodSignature(
  methodId: string,
): Promise<MethodSignature> {
  const [objectId, inputArguments, outputArguments] = await Promise.all([
    resolveMethodObjectId(methodId),
    readMethodPropertyArguments(methodId, 'InputArguments'),
    readMethodPropertyArguments(methodId, 'OutputArguments'),
  ])

  return {
    methodId,
    objectId,
    inputArguments,
    outputArguments,
  }
}

export async function resolveMethodObjectId(
  methodId: string,
): Promise<string | null> {
  const session = opcuaClientService.getSession()
  const description = new BrowseDescription({
    nodeId: coerceNodeId(methodId),
    browseDirection: BrowseDirection.Inverse,
    referenceTypeId: coerceNodeId(`i=${ReferenceTypeIds.HasComponent}`),
    includeSubtypes: true,
    nodeClassMask: 0,
    resultMask: BrowseResultMask.All,
  })

  const results = await browseAll(session, description)
  const references = results[0]?.references ?? []

  const objectRef = references.find(
    (ref) => ref.nodeClass === NodeClass.Object,
  )
  if (objectRef) {
    return objectRef.nodeId.toString()
  }

  const fallback = references[0]
  return fallback ? fallback.nodeId.toString() : null
}

async function readMethodPropertyArguments(
  methodId: string,
  propertyName: MethodPropertyName,
): Promise<MethodArgumentDef[]> {
  const propertyNodeId = await findMethodPropertyNodeId(methodId, propertyName)
  if (!propertyNodeId) {
    return []
  }

  const session = opcuaClientService.getSession()
  const response = await session.readVariableValueP(propertyNodeId)
  return parseArgumentsFromDataValue(response.value)
}

async function findMethodPropertyNodeId(
  methodId: string,
  propertyName: MethodPropertyName,
): Promise<string | null> {
  const session = opcuaClientService.getSession()
  const description = new BrowseDescription({
    nodeId: coerceNodeId(methodId),
    browseDirection: BrowseDirection.Forward,
    referenceTypeId: coerceNodeId(`i=${ReferenceTypeIds.HasProperty}`),
    includeSubtypes: true,
    nodeClassMask: 0,
    resultMask: BrowseResultMask.All,
  })

  const results = await browseAll(session, description)
  const references = results[0]?.references ?? []

  for (const ref of references) {
    if (!ref.isForward) {
      continue
    }
    const browseName = ref.browseName?.name?.trim()
    if (browseName === propertyName) {
      return ref.nodeId.toString()
    }
  }

  return null
}

export function parseArgumentsFromDataValue(
  dataValue: DataValue | undefined,
): MethodArgumentDef[] {
  const resolved = resolveDataValueStatus(dataValue)
  if (resolved.isError || !dataValue?.value?.value) {
    return []
  }

  const rawValue = dataValue.value.value
  const items = Array.isArray(rawValue) ? rawValue : [rawValue]

  return items
    .map(argumentItemToDef)
    .filter((item): item is MethodArgumentDef => item != null)
}

function argumentItemToDef(item: unknown): MethodArgumentDef | null {
  if (item instanceof Argument) {
    return rawArgumentToDef({
      name: item.name,
      dataType: item.dataType,
      valueRank: item.valueRank,
      arrayDimensions: item.arrayDimensions,
      description: item.description,
    })
  }

  const raw = extensionObjectToArgument(item)
  return raw ? rawArgumentToDef(raw) : null
}

export async function callMethod(
  objectId: string,
  methodId: string,
  inputTexts: string[],
  signature: MethodSignature,
): Promise<MethodCallResult> {
  const inputArguments = signature.inputArguments.map((def, index) => {
    const parsed = parseWriteInput(inputTexts[index] ?? '', {
      dataTypeNodeId: def.dataTypeNodeId,
      valueRank: def.valueRank,
    })

    return new Variant({
      dataType: parsed.dataType as DataType,
      arrayType:
        parsed.arrayType === 1
          ? VariantArrayType.Array
          : VariantArrayType.Scalar,
      value: parsed.value,
    })
  })

  const session = opcuaClientService.getSession()
  const response = await session.callP([
    new CallMethodRequest({
      objectId: coerceNodeId(objectId),
      methodId: coerceNodeId(methodId),
      inputArguments,
    }),
  ])

  const result = response.result[0]
  if (!result) {
    throw new Error('Call 服务无返回结果')
  }

  const statusCode = statusCodeToText(result.statusCode)
  const isError = statusIsBad(result.statusCode)

  return {
    statusCode,
    isError,
    inputArgumentResults: (result.inputArgumentResults ?? []).map((code) =>
      statusCodeToText(code),
    ),
    outputs: (result.outputArguments ?? []).map((variant, index) => ({
      name: signature.outputArguments[index]?.name ?? `Output${index + 1}`,
      displayValue: variantToDisplay(variant),
      dataTypeName:
        DataType[variant.dataType] ?? String(variant.dataType ?? '—'),
    })),
  }
}
