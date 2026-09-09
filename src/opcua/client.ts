import {
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  type ClientSession,
  type StatusCode,
} from '@wsopcua/wsopcua'
import { PEMDERCertificateStore } from '@wsopcua/wsopcua/common'

import {
  type ConnectOptions,
  type ConnectionStatus,
  NotConnectedError,
  requiresClientCertificate,
  type SecurityModeName,
  type SecurityPolicyName,
  validateEndpointUrl,
} from './types'

export type ConnectionStateListener = (
  status: ConnectionStatus,
  error?: string,
) => void

type DetachHandler = () => void

export const RECONNECT_DELAYS_MS = [800, 2000, 4000]
export const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length

export class OpcuaClientService {
  private client: OPCUAClient | null = null
  private session: ClientSession | null = null
  private listeners = new Set<ConnectionStateListener>()
  private detachHandlers: DetachHandler[] = []
  private status: ConnectionStatus = 'disconnected'
  private lastError?: string
  private lastOptions: ConnectOptions | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectGeneration = 0
  private reconnectAttempt = 0
  private userDisconnect = false

  onStateChange(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener)
    listener(this.status, this.lastError)
    return () => this.listeners.delete(listener)
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  getLastError(): string | undefined {
    return this.lastError
  }

  isConnected(): boolean {
    return this.session != null
  }

  getSession(): ClientSession {
    if (!this.session) {
      throw new NotConnectedError()
    }
    return this.session
  }

  async connect(options: ConnectOptions): Promise<void> {
    validateEndpointUrl(options.url)
    this.userDisconnect = false
    this.cancelReconnect()
    this.lastOptions = options
    await this.cleanup()
    this.emitState('connecting')
    await this.openSession(options, { emitFailure: true })
  }

  async disconnect(): Promise<void> {
    this.userDisconnect = true
    this.cancelReconnect()
    this.lastOptions = null
    await this.cleanup()
    this.emitState('disconnected')
  }

  private async openSession(
    options: ConnectOptions,
    flags: { emitFailure: boolean },
  ): Promise<void> {
    try {
      const clientOptions = buildClientOptions(options)
      this.client = new OPCUAClient(clientOptions)

      await this.client.connectP(options.url.trim())

      const sessionOptions = buildSessionOptions(options)
      this.session = await this.client.createSessionP(sessionOptions)
      this.attachRuntimeHandlers(this.client, this.session)
      this.reconnectAttempt = 0
      this.emitState('connected')
    } catch (err) {
      await this.cleanup()
      const message = err instanceof Error ? err.message : String(err)
      if (flags.emitFailure) {
        this.emitState('failed', message)
      }
      throw err
    }
  }

  private attachRuntimeHandlers(
    client: OPCUAClient,
    session: ClientSession,
  ): void {
    const onConnectionLost = (): void => {
      void this.handleRemoteDisconnect('WebSocket 连接已丢失')
    }
    const onSessionClosed = (status: StatusCode): void => {
      const detail = status.description || status.toString()
      void this.handleRemoteDisconnect(`会话已关闭 (${detail})`)
    }

    client.on('connection_lost', onConnectionLost)
    session.on('session_closed', onSessionClosed)

    this.detachHandlers.push(() => {
      client.off('connection_lost', onConnectionLost)
      session.off('session_closed', onSessionClosed)
    })
  }

  private async handleRemoteDisconnect(reason: string): Promise<void> {
    if (this.userDisconnect) {
      return
    }
    if (this.status === 'reconnecting' && !this.session && !this.client) {
      return
    }
    if (!this.session && !this.client) {
      return
    }

    const options = this.lastOptions
    await this.cleanup()

    if (!options) {
      this.emitState('failed', reason)
      return
    }

    this.reconnectAttempt = 0
    this.emitState('reconnecting', reason)
    this.scheduleReconnect(options, reason)
  }

  private scheduleReconnect(options: ConnectOptions, reason: string): void {
    this.cancelReconnectTimerOnly()
    const generation = this.reconnectGeneration
    const delay =
      RECONNECT_DELAYS_MS[
        Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
      ]

    this.reconnectTimer = setTimeout(() => {
      void this.runReconnect(options, reason, generation)
    }, delay)
  }

  private async runReconnect(
    options: ConnectOptions,
    reason: string,
    generation: number,
  ): Promise<void> {
    if (generation !== this.reconnectGeneration || this.userDisconnect) {
      return
    }

    this.reconnectAttempt += 1
    this.emitState(
      'reconnecting',
      `${reason}（第 ${this.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS} 次重试）`,
    )

    try {
      await this.openSession(options, { emitFailure: false })
    } catch (err) {
      if (generation !== this.reconnectGeneration || this.userDisconnect) {
        return
      }
      if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        const message = err instanceof Error ? err.message : String(err)
        this.emitState('failed', `重连失败: ${message}`)
        return
      }
      this.scheduleReconnect(options, reason)
    }
  }

  private cancelReconnect(): void {
    this.reconnectGeneration += 1
    this.reconnectAttempt = 0
    this.cancelReconnectTimerOnly()
  }

  private cancelReconnectTimerOnly(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private async cleanup(): Promise<void> {
    this.detachRuntimeHandlers()

    const session = this.session
    const client = this.client
    this.session = null
    this.client = null

    try {
      if (session) {
        await session.closeP()
      }
    } catch {
      /* 断开时忽略 close 异常 */
    }

    try {
      if (client) {
        await client.disconnectP()
      }
    } catch {
      /* 断开时忽略 disconnect 异常 */
    }
  }

  private detachRuntimeHandlers(): void {
    for (const detach of this.detachHandlers) {
      detach()
    }
    this.detachHandlers = []
  }

  private emitState(status: ConnectionStatus, error?: string): void {
    this.status = status
    this.lastError = error
    for (const listener of this.listeners) {
      listener(status, error)
    }
  }
}

function buildClientOptions(options: ConnectOptions) {
  const clientOptions: ConstructorParameters<typeof OPCUAClient>[0] = {
    securityMode: toMessageSecurityMode(options.securityMode),
    securityPolicy: toSecurityPolicy(options.securityPolicy),
    endpoint_must_exist: false,
    connectionStrategy: { maxRetry: 1 },
  }

  if (requiresClientCertificate(options.securityMode, options.securityPolicy)) {
    const cert = options.clientCertificate
    if (!cert?.certificatePem.trim() || !cert.privateKeyPem.trim()) {
      throw new Error('当前安全策略需要客户端证书（PEM）与私钥')
    }
    clientOptions.clientCertificateStore = new PEMDERCertificateStore(
      cert.certificatePem,
      cert.privateKeyPem,
    )
  }

  return clientOptions
}

function toMessageSecurityMode(mode: SecurityModeName): MessageSecurityMode {
  switch (mode) {
    case 'Sign':
      return MessageSecurityMode.Sign
    case 'SignAndEncrypt':
      return MessageSecurityMode.SignAndEncrypt
    default:
      return MessageSecurityMode.None
  }
}

function toSecurityPolicy(policy: SecurityPolicyName): SecurityPolicy {
  switch (policy) {
    case 'Basic256Sha256':
      return SecurityPolicy.Basic256Sha256
    default:
      return SecurityPolicy.None
  }
}

function buildSessionOptions(options: ConnectOptions) {
  if (options.identity.mode !== 'username') {
    return {}
  }

  const userName = options.identity.userName?.trim() ?? ''
  const password = options.identity.password ?? ''
  if (!userName) {
    return {}
  }

  return {
    userIdentityInfo: { userName, password },
  }
}

export const opcuaClientService = new OpcuaClientService()
