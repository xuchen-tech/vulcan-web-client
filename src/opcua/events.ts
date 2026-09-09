import {
  AttributeIds,
  ClientSubscription,
  ReadValueId,
  TimestampsToReturn,
  coerceNodeId,
  type MonitoredItem,
} from '@wsopcua/wsopcua'
import {
  ContentFilter,
  EventFilter,
  QualifiedName,
  SimpleAttributeOperand,
} from './wsopcua-generated'

import { opcuaClientService } from './client'
import {
  DEFAULT_EVENT_FIELD_NAMES,
  parseEventFieldMap,
  pickEventSummary,
} from './event-parse'
import { statusCodeToText, statusIsBad } from './status'
import type { ParsedOpcUaEvent } from './types'

export type EventReceivedHandler = (event: ParsedOpcUaEvent) => void
export type EventErrorHandler = (nodeId: string, err: unknown) => void

interface ManagedEventMonitor {
  label: string
  monitoredItem: MonitoredItem | null
  onChanged: (payload: unknown) => void
}

export class EventSubscriptionManager {
  private subscription: ClientSubscription | null = null
  private publishingInterval = 1000
  private monitors = new Map<string, ManagedEventMonitor>()
  private eventFilter = buildDefaultEventFilter()
  private onEvent: EventReceivedHandler | null = null
  private onError: EventErrorHandler | null = null

  setEventHandler(handler: EventReceivedHandler | null): void {
    this.onEvent = handler
  }

  setErrorHandler(handler: EventErrorHandler | null): void {
    this.onError = handler
  }

  getSubscribedNodeIds(): string[] {
    return [...this.monitors.keys()]
  }

  isSubscribed(nodeId: string): boolean {
    return this.monitors.has(nodeId)
  }

  async subscribe(nodeId: string, label?: string): Promise<void> {
    if (this.monitors.has(nodeId)) {
      throw new Error(`已订阅事件: ${label ?? nodeId}`)
    }

    const onChanged = (payload: unknown): void => {
      if (!Array.isArray(payload)) {
        return
      }
      const fields = parseEventFieldMap(DEFAULT_EVENT_FIELD_NAMES, payload)
      const summary = pickEventSummary(fields)
      this.onEvent?.({
        nodeId,
        label: label ?? nodeId,
        fields,
        ...summary,
      })
    }

    this.monitors.set(nodeId, {
      label: label ?? nodeId,
      monitoredItem: null,
      onChanged,
    })

    try {
      await this.setupEventMonitor(nodeId)
    } catch (err) {
      this.monitors.delete(nodeId)
      this.onError?.(nodeId, err)
      throw err
    }
  }

  async unsubscribe(nodeId: string): Promise<void> {
    const managed = this.monitors.get(nodeId)
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

    this.monitors.delete(nodeId)
    if (this.monitors.size === 0) {
      await this.disposeSubscriptionOnly()
    }
  }

  async dispose(): Promise<void> {
    const nodeIds = [...this.monitors.keys()]
    for (const nodeId of nodeIds) {
      await this.unsubscribe(nodeId)
    }
    this.onEvent = null
    this.onError = null
  }

  private async setupEventMonitor(nodeId: string): Promise<void> {
    const managed = this.monitors.get(nodeId)
    if (!managed) {
      return
    }

    const subscription = await this.ensureSubscription()
    const monitoredItem = await subscription.monitorP(
      new ReadValueId({
        nodeId: coerceNodeId(nodeId),
        attributeId: AttributeIds.EventNotifier,
      }),
      {
        samplingInterval: this.publishingInterval,
        filter: this.eventFilter,
        queueSize: 20,
        discardOldest: true,
      },
      TimestampsToReturn.Neither,
    )

    if (monitoredItem.statusCode && statusIsBad(monitoredItem.statusCode)) {
      throw new Error(
        `CreateMonitoredItem 失败: ${statusCodeToText(monitoredItem.statusCode)}`,
      )
    }

    monitoredItem.on('changed', managed.onChanged)
    managed.monitoredItem = monitoredItem
  }

  private async ensureSubscription(): Promise<ClientSubscription> {
    if (this.subscription?.isActive()) {
      return this.subscription
    }

    const session = opcuaClientService.getSession()
    const subscription = new ClientSubscription(session, {
      requestedPublishingInterval: this.publishingInterval,
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
        reject(new Error('事件订阅启动超时'))
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

  private async disposeSubscriptionOnly(): Promise<void> {
    for (const managed of this.monitors.values()) {
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
}

function buildDefaultEventFilter(): EventFilter {
  return new EventFilter({
    selectClauses: DEFAULT_EVENT_FIELD_NAMES.map(
      (name) =>
        new SimpleAttributeOperand({
          typeDefinitionId: coerceNodeId('i=2041'),
          browsePath: [new QualifiedName({ namespaceIndex: 0, name })],
          attributeId: AttributeIds.Value,
        }),
    ),
    whereClause: new ContentFilter(),
  })
}

export const eventSubscriptionManager = new EventSubscriptionManager()
