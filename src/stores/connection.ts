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
      status.value = nextStatus
      error.value = nextError ?? null
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
        return
      }
      throw err
    }

    if (needsClientCertificate.value && !hasClientCertificate.value) {
      log.err(
        'SignAndEncrypt 需要客户端证书：请选择 client_cert.pem 与 client_key.pem，并确保证书已在服务端 ApplCerts/trusted/certs/ 中信任',
      )
      return
    }

    try {
      log.info(
        `连接 ${endpoint}（${securityMode.value}/${securityPolicy.value}）…`,
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
      const message = err instanceof Error ? err.message : String(err)
      log.err(
        formatConnectErrorHint(
          message,
          endpoint,
          securityMode.value,
          securityPolicy.value,
          hasClientCertificate.value,
        ),
      )
    }
  }

  async function disconnect(): Promise<void> {
    const log = useLogStore()
    try {
      await opcuaClientService.disconnect()
      log.ok('已断开连接')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.err(`断开异常: ${message}`)
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
    needsClientCertificate,
    hasClientCertificate,
    init,
    dispose,
    loadClientCertificate,
    loadClientKey,
    connect,
    disconnect,
  }
})
