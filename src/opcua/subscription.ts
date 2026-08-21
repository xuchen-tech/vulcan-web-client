import {
  AttributeIds,
  ClientSubscription,
  DataType,
  ReadValueId,
  coerceNodeId,
  type DataValue,
  type MonitoredItem,
} from '@wsopcua/wsopcua'
import { TimestampsToReturn } from '@wsopcua/wsopcua/service-subscription'

import { opcuaClientService } from './client'
import { dateTimeToLocal, formatDataValue } from './format'
import { readValue } from './readwrite'
import { resolveDataValueStatus } from './status'
import type { MonitorRow, SubscriptionSettings, ValueReadResult } from './types'

export type MonitorRowUpdate = Partial<
  Pick<
    MonitorRow,
    | 'value'
    | 'dataType'
    | 'sourceTimestamp'
    | 'serverTimestamp'
    | 'statusCode'
    | 'isError'
  >
>

type RowUpdateHandler = (nodeId: string, update: MonitorRowUpdate) => void

interface ManagedMonitor {
  monitoredItem: MonitoredItem | null
  onChanged: (dataValue: DataValue) => void
}

const DEFAULT_SETTINGS: SubscriptionSettings = {
  publishingInterval: 1000,
  samplingInterval: 1000,
  queueSize: 1,
}

export class SubscriptionManager {
  private subscription: ClientSubscription | null = null
  private settings: SubscriptionSettings = { ...DEFAULT_SETTINGS }
  private items = new Map<string, ManagedMonitor>()
  private updateHandler: RowUpdateHandler | null = null
  private degraded = false
  private pollTimer: ReturnType<typeof setInterval> | null = null

  setUpdateHandler(handler: RowUpdateHandler | null): void {
    this.updateHandler = handler
  }

  getSettings(): SubscriptionSettings {
    return { ...this.settings }
  }

  isDegraded(): boolean {
    return this.degraded
  }

  async updateSettings(next: SubscriptionSettings): Promise<void> {
    this.settings = { ...next }
    if (this.items.size === 0) {
      return
    }

    const nodeIds = [...this.items.keys()]
    await this.disposeSubscriptionOnly()
    this.degraded = false
    await this.ensureActiveTransport()
    for (const nodeId of nodeIds) {
      await this.setupMonitor(nodeId)
    }
  }

  async addMonitor(nodeId: string): Promise<ValueReadResult> {
    if (this.items.has(nodeId)) {
      throw new Error(`已在监视表中: ${nodeId}`)
    }

    const initial = await readValue(nodeId)
    this.emitUpdate(nodeId, valueReadToMonitorUpdate(initial))

    this.items.set(nodeId, {
      monitoredItem: null,
      onChanged: (dataValue) => {
        this.emitUpdate(nodeId, dataValueToMonitorUpdate(dataValue))
      },
    })

    await this.setupMonitor(nodeId)
    return initial
  }

  async removeMonitor(nodeId: string): Promise<void> {
    const managed = this.items.get(nodeId)
    if (!managed) {
      return
    }

    if (managed.monitoredItem) {
      managed.monitoredItem.off('changed', managed.onChanged)
      try {
        await managed.monitoredItem.terminateP()
      } catch {
        /* ignore */
      }
    }

    this.items.delete(nodeId)
    if (this.items.size === 0) {
      this.stopPolling()
      await this.disposeSubscriptionOnly()
    }
  }

  async dispose(): Promise<void> {
    this.stopPolling()
    const nodeIds = [...this.items.keys()]
    for (const nodeId of nodeIds) {
      await this.removeMonitor(nodeId)
    }
    this.degraded = false
    this.updateHandler = null
  }

  private async setupMonitor(nodeId: string): Promise<void> {
    const managed = this.items.get(nodeId)
    if (!managed) {
      return
    }

    if (this.degraded) {
      this.startPolling()
      return
    }

    try {
      await this.setupSubscriptionMonitor(nodeId, managed)
    } catch {
      this.degraded = true
      managed.monitoredItem = null
      this.startPolling()
    }
  }

  private async setupSubscriptionMonitor(
    nodeId: string,
    managed: ManagedMonitor,
  ): Promise<void> {
    const subscription = await this.ensureSubscription()
    const monitoredItem = await subscription.monitorP(
      new ReadValueId({
        nodeId: coerceNodeId(nodeId),
        attributeId: AttributeIds.Value,
      }),
      {
        samplingInterval: this.settings.samplingInterval,
        discardOldest: true,
        queueSize: this.settings.queueSize,
      },
      TimestampsToReturn.Both,
    )

    monitoredItem.on('changed', managed.onChanged)
    managed.monitoredItem = monitoredItem
  }

  private async ensureSubscription(): Promise<ClientSubscription> {
    if (this.subscription?.isActive()) {
      return this.subscription
    }

    const session = opcuaClientService.getSession()
    const subscription = new ClientSubscription(session, {
      requestedPublishingInterval: this.settings.publishingInterval,
      requestedLifetimeCount: 60,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10,
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.off('started', onStarted)
        subscription.off('internal_error', onError)
        reject(new Error('订阅启动超时'))
      }, 15000)

      const onStarted = (): void => {
        clearTimeout(timeout)
        subscription.off('started', onStarted)
        subscription.off('internal_error', onError)
        resolve()
      }
      const onError = (err: Error): void => {
        clearTimeout(timeout)
        subscription.off('started', onStarted)
        subscription.off('internal_error', onError)
        reject(err)
      }
      subscription.on('started', onStarted)
      subscription.on('internal_error', onError)
    })

    this.subscription = subscription
    return subscription
  }

  private async ensureActiveTransport(): Promise<void> {
    if (this.degraded) {
      this.startPolling()
      return
    }
    await this.ensureSubscription()
  }

  private startPolling(): void {
    if (this.pollTimer || this.items.size === 0) {
      return
    }

    this.pollTimer = setInterval(() => {
      void this.pollAll()
    }, this.settings.publishingInterval)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async pollAll(): Promise<void> {
    for (const nodeId of this.items.keys()) {
      try {
        const result = await readValue(nodeId)
        this.emitUpdate(nodeId, valueReadToMonitorUpdate(result))
      } catch {
        /* 单点轮询失败不影响其他行 */
      }
    }
  }

  private async disposeSubscriptionOnly(): Promise<void> {
    this.stopPolling()
    for (const managed of this.items.values()) {
      if (managed.monitoredItem) {
        managed.monitoredItem.off('changed', managed.onChanged)
        try {
          await managed.monitoredItem.terminateP()
        } catch {
          /* ignore */
        }
        managed.monitoredItem = null
      }
    }

    if (this.subscription) {
      try {
        await this.subscription.terminateP()
      } catch {
        /* ignore */
      }
      this.subscription = null
    }
  }

  private emitUpdate(nodeId: string, update: MonitorRowUpdate): void {
    this.updateHandler?.(nodeId, update)
  }
}

function dataValueToMonitorUpdate(dataValue: DataValue): MonitorRowUpdate {
  const resolved = resolveDataValueStatus(dataValue)

  if (resolved.isError) {
    return {
      value: resolved.text,
      dataType: '—',
      sourceTimestamp: dateTimeToLocal(dataValue?.sourceTimestamp),
      serverTimestamp: dateTimeToLocal(dataValue?.serverTimestamp),
      statusCode: resolved.text,
      isError: true,
    }
  }

  const formatted = formatDataValue(dataValue)
  const dataTypeName = dataValue.value
    ? DataType[dataValue.value.dataType] ?? String(dataValue.value.dataType)
    : '—'

  return {
    value: formatted.displayValue,
    dataType: dataTypeName,
    sourceTimestamp: dateTimeToLocal(dataValue.sourceTimestamp),
    serverTimestamp: dateTimeToLocal(dataValue.serverTimestamp),
    statusCode: resolved.text,
    isError: false,
  }
}

function valueReadToMonitorUpdate(result: ValueReadResult): MonitorRowUpdate {
  const dataTypeMatch = /DataType: ([^|]+)/.exec(result.detail)
  return {
    value: result.displayValue,
    dataType: dataTypeMatch?.[1]?.trim() ?? '—',
    sourceTimestamp: extractDetailField(result.detail, 'SourceTs'),
    serverTimestamp: extractDetailField(result.detail, 'ServerTs'),
    statusCode: result.statusCode,
    isError: result.isError,
  }
}

function extractDetailField(detail: string, key: string): string {
  const match = new RegExp(`${key}:\\s*([^|]+)`).exec(detail)
  return match?.[1]?.trim() ?? '—'
}

export const subscriptionManager = new SubscriptionManager()
