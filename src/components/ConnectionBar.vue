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

function onReconnect(): void {
  void connection.reconnect()
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
    <div class="brand">
      <span class="brand-mark" />
      <div class="brand-text">
        <span class="brand-name">VULCAN</span>
        <span class="brand-sub">OPC UA CLIENT</span>
      </div>
    </div>

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
        :disabled="!connection.canConnect"
        @click="connection.isFailed ? onReconnect() : onConnect()"
      >
        {{ connection.connectButtonLabel }}
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

    <div
      class="status-wrap"
      :class="{ 'status-wrap-failed': connection.isFailed }"
      :title="connection.error ?? undefined"
    >
      <span class="status-led" :class="statusClass" />
      <div class="status-copy">
        <span class="status-text">{{ connection.statusLabel }}</span>
        <span v-if="connection.error" class="status-error">{{ connection.error }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.connection-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 0.85rem;
  padding: 0.55rem 0.85rem;
  background:
    linear-gradient(180deg, #1a222b 0%, var(--bg-header) 100%);
  color: var(--text);
  border-bottom: 1px solid var(--border-accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.35rem;
  padding-right: 0.85rem;
  border-right: 1px solid var(--border);
}

.brand-mark {
  width: 0.55rem;
  height: 1.55rem;
  background: linear-gradient(180deg, var(--accent), #8a5a10);
  box-shadow: 0 0 10px rgba(232, 163, 23, 0.45);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.brand-name {
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text);
}

.brand-sub {
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  color: var(--accent);
  font-weight: 700;
}

.field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 650;
}

.field-input {
  padding: 0.28rem 0.45rem;
  font-size: 0.8rem;
}

.url-input {
  min-width: 16.5rem;
  font-family: var(--font-mono);
}

.file-field {
  max-width: 11rem;
}

.file-input {
  max-width: 8rem;
  font-size: 0.72rem;
}

.cert-status {
  font-size: 0.72rem;
  white-space: nowrap;
}

.cert-ready {
  color: var(--good);
}

.cert-missing {
  color: var(--warn);
}

.actions {
  display: flex;
  gap: 0.4rem;
}

.btn {
  padding: 0.32rem 0.8rem;
  border: 1px solid transparent;
  font-size: 0.72rem;
}

.btn-connect {
  background: linear-gradient(180deg, #3d9a5c, #247a42);
  color: #e8ffef;
  border-color: #4ade80;
}

.btn-connect:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-disconnect {
  background: var(--bg-inset);
  color: var(--text);
  border-color: var(--border-strong);
}

.btn-disconnect:hover:not(:disabled) {
  border-color: var(--bad);
  color: var(--bad);
}

.status-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  max-width: 100%;
  padding: 0.2rem 0.55rem 0.2rem 0.35rem;
  background: var(--bg-inset);
  border: 1px solid var(--border);
}

.status-led {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
}

.status-disconnected {
  background: #4b5563;
}

.status-connecting {
  background: var(--warn);
  box-shadow: 0 0 8px rgba(232, 163, 23, 0.8);
  animation: pulse 1s ease-in-out infinite;
}

.status-connected {
  background: var(--good);
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.75);
}

.status-failed {
  background: var(--bad);
  box-shadow: 0 0 8px rgba(240, 113, 103, 0.7);
}

.status-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.status-text {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  white-space: nowrap;
}

.status-wrap-failed .status-text {
  color: var(--bad);
}

.status-error {
  font-size: 0.68rem;
  color: var(--bad);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 20rem;
}

@keyframes pulse {
  50% {
    opacity: 0.45;
  }
}
</style>
