import {
  HistoryReadRequest,
  HistoryReadValueId,
  ReadRawModifiedDetails,
  TimestampsToReturn,
  coerceNodeId,
  type ClientSession,
  type DataValue,
  type HistoryReadResponse,
  type Variant,
} from '@wsopcua/wsopcua'

import { opcuaClientService } from './client'
import { dateTimeToLocal, variantToDisplay } from './format'
import {
  DEFAULT_NUM_VALUES,
  MAX_HISTORY_PAGES,
  MAX_NUM_VALUES,
  extractHistoryDataValues,
  extractNumericValue,
  hasContinuationPoint,
  isNoDataPlaceholder,
  sortHistoryNewestFirst,
  timestampMs,
} from './history-parse'
import { resolveDataValueStatus, statusCodeToText, statusIsBad, statusIsNoData } from './status'
import type {
  HistoryReadOutcome,
  HistoryReadQuery,
  HistorySample,
} from './types'

type SessionWithHistoryTx = ClientSession & {
  performMessageTransaction: (
    request: HistoryReadRequest,
    callback: (err: Error | null, response?: HistoryReadResponse) => void,
  ) => void
}

export async function readHistoryRaw(
  query: HistoryReadQuery,
): Promise<HistoryReadOutcome> {
  const session = opcuaClientService.getSession()
  const numValues = Math.min(
    Math.max(Math.floor(query.numValuesPerNode || DEFAULT_NUM_VALUES), 1),
    MAX_NUM_VALUES,
  )
  const details = new ReadRawModifiedDetails({
    isReadModified: false,
    startTime: query.startTime,
    endTime: query.endTime,
    numValuesPerNode: numValues,
    returnBounds: false,
  })

  const samples: HistorySample[] = []
  let continuationPoint: Uint8Array | undefined
  let truncated = false
  let lastStatus = 'Good'

  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const response = await historyReadTransaction(session, details, query.nodeId, continuationPoint)
    const result = response.results?.[0]
    if (!result) {
      throw new Error('HistoryRead 无结果')
    }

    lastStatus = statusCodeToText(result.statusCode)
    if (statusIsNoData(result.statusCode)) {
      break
    }
    if (result.statusCode && statusIsBad(result.statusCode)) {
      return {
        nodeId: query.nodeId,
        statusCode: lastStatus,
        isError: true,
        samples: sortHistoryNewestFirst(samples.filter((sample) => !isNoDataPlaceholder(sample))),
        truncated: false,
      }
    }

    const values = extractHistoryDataValues(result.historyData)
    for (const value of values) {
      const sample = dataValueToSample(value as DataValue)
      if (!isNoDataPlaceholder(sample)) {
        samples.push(sample)
      }
    }

    if (hasContinuationPoint(result.continuationPoint)) {
      continuationPoint = result.continuationPoint
      if (page === MAX_HISTORY_PAGES - 1) {
        truncated = true
      }
    } else {
      break
    }
  }

  return {
    nodeId: query.nodeId,
    statusCode: lastStatus,
    isError: false,
    samples: sortHistoryNewestFirst(samples),
    truncated,
  }
}

function historyReadTransaction(
  session: ClientSession,
  details: ReadRawModifiedDetails,
  nodeId: string,
  continuationPoint: Uint8Array | undefined,
): Promise<HistoryReadResponse> {
  const request = new HistoryReadRequest({
    historyReadDetails: details,
    timestampsToReturn: TimestampsToReturn.Both,
    releaseContinuationPoints: false,
    nodesToRead: [
      new HistoryReadValueId({
        nodeId: coerceNodeId(nodeId),
        continuationPoint,
      }),
    ],
  })

  const tx = session as SessionWithHistoryTx
  return new Promise((resolve, reject) => {
    tx.performMessageTransaction(request, (err, response) => {
      if (err) {
        reject(err)
        return
      }
      if (!response) {
        reject(new Error('HistoryRead 无响应'))
        return
      }
      resolve(response)
    })
  })
}

function dataValueToSample(dataValue: DataValue | undefined): HistorySample {
  const resolved = resolveDataValueStatus(dataValue)
  const variant = dataValue?.value as Variant | undefined
  return {
    displayValue: variant
      ? variantToDisplay(variant)
      : resolved.isError
        ? resolved.text
        : '<null>',
    numericValue: extractNumericValue(variant?.value),
    sourceTimestamp: dateTimeToLocal(dataValue?.sourceTimestamp),
    sourceTimestampMs: timestampMs(dataValue?.sourceTimestamp),
    serverTimestamp: dateTimeToLocal(dataValue?.serverTimestamp),
    statusCode: resolved.text,
    isError: resolved.isError,
  }
}
