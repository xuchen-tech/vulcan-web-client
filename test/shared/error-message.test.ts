import { describe, expect, it, vi } from 'vitest'

import { logActionError, toErrorMessage } from '@/shared/error-message'

describe('error-message', () => {
  it('stringifies Error instances', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
    expect(toErrorMessage('plain')).toBe('plain')
  })

  it('logs formatted action errors', () => {
    const sink = { err: vi.fn() }
    const message = logActionError(sink, 'browse failed', new Error('timeout'))

    expect(message).toBe('timeout')
    expect(sink.err).toHaveBeenCalledWith('browse failed: timeout')
  })
})
