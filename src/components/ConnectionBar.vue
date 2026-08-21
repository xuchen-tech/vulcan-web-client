<script setup lang="ts">
import { computed } from 'vue'

import {
  SECURITY_MODE_OPTIONS,
  SECURITY_POLICY_OPTIONS,
  type ConnectionStatus,
} from '@/opcua/types'
import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()

const statusClass = computed(() => {
  const map: Record<ConnectionStatus, string> = {
    disconnected: 'status-disconnected',
    connecting: 'status-connecting',
    connected: 'status-connected',
    failed: 'status-failed',
    reconnecting: 'status-connecting',
  }
  return map[connection.status]
})

function onConnect(): void {
  void connection.connect()
}

function onDisconnect(): void {
  void connection.disconnect()
}

function onCertFile(event: Event): void {
  const input = event.target as HTMLInputElement
  void connection.loadClientCertificate(input.files?.[0])
}

function onKeyFile(event: Event): void {
  const input = event.target as HTMLInputElement
  void connection.loadClientKey(input.files?.[0])
}
</script>

<template>
  <header class="connection-bar">
    <span class="bar-label">Connection</span>

    <label class="field">
      <span class="field-label">URL</span>
      <input
        v-model="connection.url"
        type="text"
        class="field-input url-input"
        placeholder="ws://127.0.0.1:4843/opcua"
        :disabled="connection.isConnected || connection.isBusy"
      />
    </label>

    <label class="field">
      <span class="field-label">Security</span>
      <select
        v-model="connection.securityMode"
        class="field-input"
        :disabled="connection.isConnected || connection.isBusy"
      >
        <option v-for="mode in SECURITY_MODE_OPTIONS" :key="mode" :value="mode">
          {{ mode }}
        </option>
      </select>
    </label>

    <label class="field">
      <span class="field-label">Policy</span>
      <select
        v-model="connection.securityPolicy"
        class="field-input"
        :disabled="connection.isConnected || connection.isBusy"
      >
        <option
          v-for="policy in SECURITY_POLICY_OPTIONS"
          :key="policy"
          :value="policy"
        >
          {{ policy }}
        </option>
      </select>
    </label>

    <label class="field">
      <span class="field-label">Identity</span>
      <select
        v-model="connection.identityMode"
        class="field-input"
        :disabled="connection.isConnected || connection.isBusy"
      >
        <option value="anonymous">Anonymous</option>
        <option value="username">Username</option>
      </select>
    </label>

    <template v-if="connection.identityMode === 'username'">
      <label class="field">
        <span class="field-label">User</span>
        <input
          v-model="connection.userName"
          type="text"
          class="field-input"
          autocomplete="username"
          :disabled="connection.isConnected || connection.isBusy"
        />
      </label>
      <label class="field">
        <span class="field-label">Password</span>
        <input
          v-model="connection.password"
          type="password"
          class="field-input"
          autocomplete="current-password"
          :disabled="connection.isConnected || connection.isBusy"
        />
      </label>
    </template>

    <template v-if="connection.needsClientCertificate">
      <label class="field file-field">
        <span class="field-label">Client Cert</span>
        <input
          type="file"
          accept=".pem,.crt,.cer,.der"
          class="field-input file-input"
          :disabled="connection.isConnected || connection.isBusy"
          @change="onCertFile"
        />
      </label>
      <label class="field file-field">
        <span class="field-label">Client Key</span>
        <input
          type="file"
          accept=".pem,.key"
          class="field-input file-input"
          :disabled="connection.isConnected || connection.isBusy"
          @change="onKeyFile"
        />
      </label>
      <span
        class="cert-status"
        :class="connection.hasClientCertificate ? 'cert-ready' : 'cert-missing'"
      >
        {{ connection.hasClientCertificate ? '证书已选' : '需 PEM 证书+私钥' }}
      </span>
    </template>

    <div class="actions">
      <button
        type="button"
        class="btn btn-connect"
        :disabled="connection.isConnected || connection.isBusy"
        @click="onConnect"
      >
        Connect
      </button>
      <button
        type="button"
        class="btn btn-disconnect"
        :disabled="!connection.isConnected && !connection.isBusy"
        @click="onDisconnect"
      >
        Disconnect
      </button>
    </div>

    <div class="status-wrap" :title="connection.error ?? undefined">
      <span class="status-dot" :class="statusClass" />
      <span class="status-text">{{ connection.statusLabel }}</span>
      <span v-if="connection.error" class="status-error">{{ connection.error }}</span>
    </div>
  </header>
</template>

<style scoped>
.connection-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 1rem;
  background: #24292f;
  color: #f0f6fc;
  border-bottom: 1px solid #30363d;
}

.bar-label {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b949e;
  margin-right: 0.25rem;
}

.field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.75rem;
  color: #8b949e;
  white-space: nowrap;
}

.field-input {
  padding: 0.25rem 0.45rem;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: #0d1117;
  color: #f0f6fc;
  font-size: 0.85rem;
}

.field-input:disabled {
  opacity: 0.6;
}

.url-input {
  min-width: 16rem;
}

.file-field {
  max-width: 11rem;
}

.file-input {
  max-width: 8rem;
  font-size: 0.75rem;
}

.cert-status {
  font-size: 0.75rem;
  white-space: nowrap;
}

.cert-ready {
  color: #7ee787;
}

.cert-missing {
  color: #e3b341;
}

.actions {
  display: flex;
  gap: 0.4rem;
}

.btn {
  padding: 0.3rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-connect {
  background: #238636;
  color: #fff;
}

.btn-connect:hover:not(:disabled) {
  background: #2ea043;
}

.btn-disconnect {
  background: #21262d;
  color: #f0f6fc;
  border-color: #30363d;
}

.btn-disconnect:hover:not(:disabled) {
  background: #30363d;
}

.status-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
  max-width: 100%;
}

.status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-disconnected {
  background: #6e7681;
}

.status-connecting {
  background: #d29922;
}

.status-connected {
  background: #3fb950;
}

.status-failed {
  background: #f85149;
}

.status-text {
  font-size: 0.85rem;
  white-space: nowrap;
}

.status-error {
  font-size: 0.75rem;
  color: #ffa198;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 20rem;
}
</style>
