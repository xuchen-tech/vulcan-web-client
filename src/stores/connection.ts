import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { opcuaClientService } from '@/opcua/client'
import {
  type ConnectionStatus,
  type IdentityMode,
  type SecurityModeName,
  type SecurityPolicyName,
  CONNECTION_STATUS_LABEL,
  formatConnectErrorHint,
  InvalidEndpointUrlError,
  requiresClientCertificate,
  validateEndpointUrl,
} from '@/opcua/types'
import { logActionError, toErrorMessage } from '@/shared/error-message'

import { useLogStore } from './log'

/** 开发联调默认：vulcan_server 4840 --ws 4843（不带 --pki）；用 127.0.0.1 避免 localhost→::1 */
const DEFAULT_DEV_WS_URL = 'ws://127.0.0.1:4843/opcua'

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionStatus>('disconnected')
  const error = ref<string | null>(null)
  const url = ref(DEFAULT_DEV_WS_URL)
  const securityMode = ref<SecurityModeName>('None')
  const securityPolicy = ref<SecurityPolicyName>('None')
  const identityMode = ref<IdentityMode>('anonymous')
  const userName = ref('')
  const password = ref('')
  const clientCertPem = ref('')
  const clientKeyPem = ref('')

  let teardown: (() => void) | null = null

  const statusLabel = computed(() => CONNECTION_STATUS_LABEL[status.value])
  const isConnected = computed(() => status.value === 'connected')
  const isBusy = computed(
    () => status.value === 'connecting' || status.value === 'reconnecting',
  )
  const isFailed = computed(() => status.value === 'failed')
  const canConnect = computed(() => !isConnected.value && !isBusy.value)
  const connectButtonLabel = computed(() =>
    isFailed.value ? 'Reconnect' : 'Connect',
  )
  const needsClientCertificate = computed(() =>
    requiresClientCertificate(securityMode.value, securityPolicy.value),
  )
  const hasClientCertificate = computed(
    () => clientCertPem.value.trim().length > 0 && clientKeyPem.value.trim().length > 0,
  )

  function init(): void {
    if (teardown) {
      return
    }

    teardown = opcuaClientService.onStateChange((nextStatus, nextError) => {
      const previous = status.value
      status.value = nextStatus
      error.value = nextError ?? null

      const log = useLogStore()
      if (
        previous === 'connected' &&
        nextStatus === 'failed' &&
        nextError
      ) {
        log.warn(`连接中断: ${nextError}`)
      }
    })

    window.addEventListener('beforeunload', onBeforeUnload)
  }

  function dispose(): void {
    window.removeEventListener('beforeunload', onBeforeUnload)
    teardown?.()
    teardown = null
  }

  function onBeforeUnload(): void {
    void opcuaClientService.disconnect()
  }

  async function loadClientCertificate(file: File | undefined): Promise<void> {
    clientCertPem.value = file ? await file.text() : ''
  }

  async function loadClientKey(file: File | undefined): Promise<void> {
    clientKeyPem.value = file ? await file.text() : ''
  }

  async function connect(): Promise<void> {
    const log = useLogStore()
    const endpoint = url.value.trim()

    try {
      validateEndpointUrl(endpoint)
    } catch (err) {
      if (err instanceof InvalidEndpointUrlError) {
        log.err(err.message)
        status.value = 'failed'
        error.value = err.message
        return
      }
      throw err
    }

    if (needsClientCertificate.value && !hasClientCertificate.value) {
      const message =
        'SignAndEncrypt 需要客户端证书：请选择 client_cert.pem 与 client_key.pem，并确保证书已在服务端 ApplCerts/trusted/certs/ 中信任'
      log.err(message)
      status.value = 'failed'
      error.value = message
      return
    }

    try {
      log.info(
        `${isFailed.value ? '重连' : '连接'} ${endpoint}（${securityMode.value}/${securityPolicy.value}）…`,
      )
      await opcuaClientService.connect({
        url: endpoint,
        securityMode: securityMode.value,
        securityPolicy: securityPolicy.value,
        identity: {
          mode: identityMode.value,
          userName: userName.value,
          password: password.value,
        },
        clientCertificate: hasClientCertificate.value
          ? {
              certificatePem: clientCertPem.value,
              privateKeyPem: clientKeyPem.value,
            }
          : undefined,
      })
      log.ok(`会话建立成功（${endpoint}）`)
    } catch (err) {
      log.err(
        formatConnectErrorHint(
          toErrorMessage(err),
          endpoint,
          securityMode.value,
          securityPolicy.value,
          hasClientCertificate.value,
        ),
      )
    }
  }

  async function reconnect(): Promise<void> {
    await connect()
  }

  async function disconnect(): Promise<void> {
    const log = useLogStore()
    try {
      await opcuaClientService.disconnect()
      log.ok('已断开连接')
    } catch (err) {
      logActionError(log, '断开异常', err)
    }
  }

  return {
    status,
    error,
    url,
    securityMode,
    securityPolicy,
    identityMode,
    userName,
    password,
    clientCertPem,
    clientKeyPem,
    statusLabel,
    isConnected,
    isBusy,
    isFailed,
    canConnect,
    connectButtonLabel,
    needsClientCertificate,
    hasClientCertificate,
    init,
    dispose,
    loadClientCertificate,
    loadClientKey,
    connect,
    reconnect,
    disconnect,
  }
})
