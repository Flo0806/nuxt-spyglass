import { describe, it, expect } from 'vitest'
import { appendEvlogDrain, type EvlogDrainContext } from '../src/runtime/server/evlog'
import type { LogEntry } from '../src/runtime/types'

function fakeStore() {
  const entries: LogEntry[] = []
  return { entries, append: (e: LogEntry) => entries.push(e) }
}

describe('appendEvlogDrain', () => {
  it('expands requestLogs and adds a correlated wide-event summary', () => {
    const store = fakeStore()
    const ctx: EvlogDrainContext = {
      event: {
        timestamp: '2026-05-30T10:00:00.000Z',
        level: 'error',
        status: 200,
        requestLogs: [
          { level: 'info', message: 'hello', timestamp: '2026-05-30T10:00:00.100Z' },
          { level: 'warn', message: 'careful' },
        ],
        error: new Error('boom'),
        userId: 'flo',
      },
      request: { method: 'GET', path: '/api/x', requestId: 'req-1' },
      headers: { 'x-spyglass-page': '80d04154-9e88-446c-a8fe-caaea2914ae8' },
    }

    appendEvlogDrain(store, ctx)

    expect(store.entries).toHaveLength(3)
    const [info, warn, wide] = store.entries

    // per-request logs become individual entries, correlated + routed
    expect(info).toMatchObject({ level: 'info', message: 'hello', source: 'server', route: '/api/x' })
    expect(warn).toMatchObject({ level: 'warn', message: 'careful' })

    // the wide event is a request summary carrying fields + the error stack
    expect(wide!.message).toBe('[evlog] GET /api/x -> 200')
    expect(wide!.level).toBe('error')
    expect(wide!.stack).toContain('boom')
    expect(wide!.args?.[0]).toMatchObject({ userId: 'flo' })

    // correlation reuses the x-spyglass-page header across all entries
    for (const e of store.entries) {
      expect(e.pageLoadId).toBe('80d04154-9e88-446c-a8fe-caaea2914ae8')
      expect(e.requestId).toBe('req-1')
    }
  })

  it('falls back to evlog\'s requestId when no page header is present', () => {
    const store = fakeStore()
    appendEvlogDrain(store, {
      event: { timestamp: '2026-05-30T10:00:00.000Z', level: 'info', message: 'evt' },
      request: { requestId: 'req-2' },
    })
    expect(store.entries[0]?.pageLoadId).toBe('req-2')
  })
})
