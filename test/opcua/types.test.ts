import { describe, expect, it } from 'vitest'

import {
  formatConnectErrorHint,
  InvalidEndpointUrlError,
  requiresClientCertificate,
  validateEndpointUrl,
} from '@/opcua/types'

describe('validateEndpointUrl', () => {
  it('accepts ws:// URLs', () => {
    expect(() => validateEndpointUrl('ws://localhost:4843/opcua')).not.toThrow()
  })

  it('accepts wss:// URLs', () => {
    expect(() => validateEndpointUrl('wss://localhost:4843/opcua')).not.toThrow()
  })

  it('rejects non-WebSocket URLs', () => {
    expect(() => validateEndpointUrl('opc.tcp://localhost:4840')).toThrow(
      InvalidEndpointUrlError,
    )
  })

  it('rejects empty protocol', () => {
    expect(() => validateEndpointUrl('localhost:4843')).toThrow(
      InvalidEndpointUrlError,
    )
  })
})

describe('requiresClientCertificate', () => {
  it('returns false for None/None', () => {
    expect(requiresClientCertificate('None', 'None')).toBe(false)
  })

  it('returns true for SignAndEncrypt', () => {
    expect(requiresClientCertificate('SignAndEncrypt', 'Basic256Sha256')).toBe(
      true,
    )
  })
})

describe('formatConnectErrorHint', () => {
  it('adds dev ws hint for ws:// with None security', () => {
    const text = formatConnectErrorHint(
      'failed to connect',
      'ws://localhost:4843/opcua',
      'None',
      'None',
      false,
    )
    expect(text).toContain('plain, no TLS')
  })
})
