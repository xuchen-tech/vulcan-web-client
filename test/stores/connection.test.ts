import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const connectMock = vi.fn()
const disconnectMock = vi.fn()

vi.mock('@/opcua/client', () => ({
  opcuaClientService: {
    connect: (...args: unknown[]) => connectMock(...args),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
    onStateChange: vi.fn(() => () => {}),
  },
}))

import { useConnectionStore } from '@/stores/connection'
import { useLogStore } from '@/stores/log'

describe('useConnectionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    connectMock.mockReset()
    disconnectMock.mockReset()
  })

  it('logs and rejects invalid URL without calling connect', async () => {
    const connection = useConnectionStore()
    const log = useLogStore()
    connection.url = 'opc.tcp://localhost:4840'

    await connection.connect()

    expect(connectMock).not.toHaveBeenCalled()
    expect(connection.status).not.toBe('connected')
    expect(log.entries.some((e) => e.level === 'err')).toBe(true)
  })

  it('logs success when connect succeeds', async () => {
    connectMock.mockResolvedValue(undefined)

    const connection = useConnectionStore()
    const log = useLogStore()
    connection.url = 'ws://localhost:4843/opcua'
    connection.securityMode = 'None'
    connection.securityPolicy = 'None'

    await connection.connect()

    expect(connectMock).toHaveBeenCalledOnce()
    expect(log.entries.some((e) => e.level === 'ok')).toBe(true)
  })

  it('logs failure when connect throws', async () => {
    connectMock.mockRejectedValue(new Error('ECONNREFUSED'))

    const connection = useConnectionStore()
    const log = useLogStore()
    connection.url = 'ws://localhost:4843/opcua'
    connection.securityMode = 'None'
    connection.securityPolicy = 'None'

    await connection.connect()

    expect(connection.status).not.toBe('connected')
    expect(log.entries.some((e) => e.message.includes('ECONNREFUSED'))).toBe(
      true,
    )
  })
})
