import { describe, it, expect } from 'vitest'
import { recentLogs, recentErrors, search, logsForPage, logsSince } from '../src/mcp/queries'
import type { LogEntry } from '../src/runtime/types'

function entry(p: Partial<LogEntry> & { timestamp: number }): LogEntry {
  return { level: 'log', source: 'server', message: '', ...p }
}

const data: LogEntry[] = [
  entry({ timestamp: 1, message: 'a', level: 'info' }),
  entry({ timestamp: 2, message: 'framework noise', noise: true }),
  entry({ timestamp: 3, message: 'boom', level: 'error', pageLoadId: 'p1' }),
  entry({ timestamp: 3, message: 'boom2', level: 'error', pageLoadId: 'p1' }), // tie at ts=3
  entry({ timestamp: 4, message: 'b', level: 'warn', source: 'browser', pageLoadId: 'p2' }),
]

describe('recentLogs', () => {
  it('hides noise by default, includes it when asked', () => {
    expect(recentLogs(data).some(e => e.noise)).toBe(false)
    expect(recentLogs(data, { includeNoise: true }).some(e => e.noise)).toBe(true)
  })

  it('filters by level and source, stays chronological, respects limit', () => {
    expect(recentLogs(data, { level: 'error' })).toHaveLength(2)
    expect(recentLogs(data, { source: 'browser' }).every(e => e.source === 'browser')).toBe(true)
    expect(recentLogs(data, { limit: 2, includeNoise: true }).map(e => e.timestamp)).toEqual([3, 4])
  })
})

describe('recentErrors / search / logsForPage', () => {
  it('recentErrors returns only errors', () => {
    expect(recentErrors(data).map(e => e.message)).toEqual(['boom', 'boom2'])
  })

  it('search is case-insensitive and hides noise by default', () => {
    expect(search(data, 'BOOM').map(e => e.message)).toEqual(['boom', 'boom2'])
    expect(search(data, 'noise')).toHaveLength(0)
    expect(search(data, 'noise', 50, true)).toHaveLength(1)
  })

  it('logsForPage returns the full tree of one page load', () => {
    expect(logsForPage(data, 'p1').map(e => e.message)).toEqual(['boom', 'boom2'])
    expect(logsForPage(data, 'nope')).toHaveLength(0)
  })
})

describe('logsSince (incremental cursor)', () => {
  it('first call returns a baseline tail and a cursor', () => {
    const { fresh, cursor } = logsSince(data, null)
    expect(fresh).toHaveLength(5)
    expect(cursor).toEqual({ ts: 4, tsCount: 1 })
  })

  it('is tie-safe: a cursor mid-way through a shared timestamp resumes correctly', () => {
    // one of the two ts=3 entries already consumed
    const { fresh } = logsSince(data, { ts: 3, tsCount: 1 })
    expect(fresh.map(e => e.message)).toEqual(['boom2', 'b'])
  })

  it('returns nothing new when the cursor is at the head', () => {
    const { fresh } = logsSince(data, { ts: 4, tsCount: 1 })
    expect(fresh).toHaveLength(0)
  })
})
