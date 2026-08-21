export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'reconnecting'

export type IdentityMode = 'anonymous' | 'username'

export type SecurityModeName = 'None' | 'Sign' | 'SignAndEncrypt'

export type SecurityPolicyName = 'None' | 'Basic256Sha256'

export interface ConnectIdentity {
  mode: IdentityMode
  userName?: string
  password?: string
}

export interface ClientCertificatePem {
  certificatePem: string
  privateKeyPem: string
}

export interface ConnectOptions {
  url: string
  securityMode: SecurityModeName
  securityPolicy: SecurityPolicyName
  identity: ConnectIdentity
  clientCertificate?: ClientCertificatePem
}

export class InvalidEndpointUrlError extends Error {
  constructor(url: string) {
    super(`端点 URL 必须以 ws:// 或 wss:// 开头: ${url}`)
    this.name = 'InvalidEndpointUrlError'
  }
}

export class NotConnectedError extends Error {
  constructor(message = '未连接') {
    super(message)
    this.name = 'NotConnectedError'
  }
}

export function requiresClientCertificate(
  securityMode: SecurityModeName,
  securityPolicy: SecurityPolicyName,
): boolean {
  return securityMode !== 'None' || securityPolicy !== 'None'
}

export function formatConnectErrorHint(
  message: string,
  url: string,
  securityMode: SecurityModeName,
  securityPolicy: SecurityPolicyName,
  hasClientCertificate: boolean,
): string {
  const hints = [message]
  const opcNone =
    securityMode === 'None' && securityPolicy === 'None'

  if (url.startsWith('ws://') && opcNone) {
    hints.push(
      '确认服务端日志含 plain, no TLS (dev)（命令：vulcan_server 4840 --ws 4843，不要加 --pki）',
    )
    hints.push('可尝试 ws://127.0.0.1:4843/opcua（避免 localhost 解析到 IPv6 ::1）')
  } else if (url.startsWith('ws://')) {
    hints.push(
      'vulcan_server --pki --ws 仅支持 wss://，请改用 wss://localhost:4843/opcua',
    )
  }

  if (
    requiresClientCertificate(securityMode, securityPolicy) &&
    !hasClientCertificate
  ) {
    hints.push(
      'SignAndEncrypt 需上传客户端证书（PEM）与私钥，并放入服务端 ApplCerts/trusted/certs/',
    )
  }

  if (
    url.startsWith('wss://') &&
    /failed to connect|WebSocket|network|ERR_|certificate/i.test(message)
  ) {
    hints.push(
      '浏览器需先信任服务端 TLS 证书（自签名：访问 https://localhost:4843 接受警告，或导入 server_cert.der）',
    )
  }

  return hints.join('；')
}

export function validateEndpointUrl(url: string): void {
  if (!/^wss?:\/\//.test(url.trim())) {
    throw new InvalidEndpointUrlError(url.trim())
  }
}

export const SECURITY_MODE_OPTIONS: SecurityModeName[] = [
  'None',
  'Sign',
  'SignAndEncrypt',
]

export const SECURITY_POLICY_OPTIONS: SecurityPolicyName[] = [
  'None',
  'Basic256Sha256',
]

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: '未连接',
  connecting: '连接中…',
  connected: '已连接',
  failed: '失败',
  reconnecting: '重连中…',
}

/** OPC UA NodeClass 数值（与 @wsopcua/wsopcua NodeClass 枚举一致） */
export type OpcNodeClass =
  | 0
  | 1
  | 2
  | 4
  | 8
  | 16
  | 32
  | 64
  | 128

export interface NodeInfo {
  nodeId: string
  browseName: string
  displayName: string
  nodeClass: OpcNodeClass
  typeDefinition?: string
  /** 是否可能有子节点（展开后为空则改为 false） */
  hasChildren?: boolean
}

export interface AttrRow {
  attributeId: number
  attributeName: string
  displayValue: string
  statusCode: string
  isError: boolean
  /** Value 等属性的附加详情（时间戳、DataType 等） */
  detail?: string
}

export interface RefRow {
  referenceType: string
  isForward: boolean
  targetBrowseName: string
  targetNodeId: string
  targetNodeClass: string
  typeDefinition: string
}

export interface ValueReadResult {
  nodeId: string
  displayValue: string
  detail: string
  statusCode: string
  isError: boolean
}

export interface WriteValueResult {
  nodeId: string
  writtenValue: string
  writeStatusCode: string
  writeOk: boolean
  readBack?: ValueReadResult
}

export interface MonitorRow {
  nodeId: string
  label: string
  value: string
  dataType: string
  sourceTimestamp: string
  serverTimestamp: string
  statusCode: string
  isError: boolean
  writeBusy: boolean
}

export interface SubscriptionSettings {
  publishingInterval: number
  samplingInterval: number
  queueSize: number
}
