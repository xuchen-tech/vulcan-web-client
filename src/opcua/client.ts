import {
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  type ClientSession,
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

export class OpcuaClientService {
  private client: OPCUAClient | null = null
  private session: ClientSession | null = null
  private listeners = new Set<ConnectionStateListener>()

  onStateChange(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
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
    await this.cleanup()
    this.emitState('connecting')

    try {
      const clientOptions = buildClientOptions(options)
      this.client = new OPCUAClient(clientOptions)

      await this.client.connectP(options.url.trim())

      const sessionOptions = buildSessionOptions(options)
      this.session = await this.client.createSessionP(sessionOptions)
      this.emitState('connected')
    } catch (err) {
      await this.cleanup()
      const message = err instanceof Error ? err.message : String(err)
      this.emitState('failed', message)
      throw err
    }
  }

  async disconnect(): Promise<void> {
    await this.cleanup()
    this.emitState('disconnected')
  }

  private async cleanup(): Promise<void> {
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

  private emitState(status: ConnectionStatus, error?: string): void {
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
