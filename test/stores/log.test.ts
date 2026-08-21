import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useLogStore } from '@/stores/log'

describe('useLogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores entries with levels and trims old rows', () => {
    const log = useLogStore()

    log.info('one')
    log.err('two')

    expect(log.entries).toHaveLength(2)
    expect(log.entries[0]?.level).toBe('info')
    expect(log.entries[1]?.level).toBe('err')
    expect(log.levelCounts.err).toBe(1)
  })

  it('filters entries by level', () => {
    const log = useLogStore()

    log.info('info')
    log.ok('ok')
    log.filterLevel = 'ok'

    expect(log.filteredEntries).toHaveLength(1)
    expect(log.filteredEntries[0]?.level).toBe('ok')
  })
})
