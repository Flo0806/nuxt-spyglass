import { existsSync, readFileSync } from 'node:fs'
import type { LogEntry, LogLevel, LogSource } from '../runtime/types'

function parseInto(file: string, entries: LogEntry[]): void {
  if (!existsSync(file)) {
    return
  }
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) {
      continue
    }
    try {
      entries.push(JSON.parse(line) as LogEntry)
    }
    catch {
      // Skip a torn/half-written line rather than failing the whole query.
    }
  }
}

/** Read both the rotated (`.1`, older) and active NDJSON files; malformed lines skipped. */
export function readEntries(file: string): LogEntry[] {
  const entries: LogEntry[] = []
  parseInto(`${file}.1`, entries)
  parseInto(file, entries)
  return entries
}

const byTime = (a: LogEntry, b: LogEntry): number => a.timestamp - b.timestamp

export interface RecentOptions {
  limit?: number
  level?: LogLevel
  source?: LogSource
  /** Only entries at or after this Unix epoch (ms). */
  since?: number
  /** Include framework/ambient noise (Vue warnings, devtools, build lifecycle). Default false. */
  includeNoise?: boolean
}

/** Most recent entries (chronological), with optional filters. Hides noise unless asked. */
export function recentLogs(entries: LogEntry[], options: RecentOptions = {}): LogEntry[] {
  const { limit = 50, level, source, since, includeNoise = false } = options
  const filtered = entries.filter(e =>
    (level === undefined || e.level === level)
    && (source === undefined || e.source === source)
    && (since === undefined || e.timestamp >= since)
    && (includeNoise || !e.noise),
  )
  return filtered.sort(byTime).slice(-limit)
}

/** The most recent errors from both browser and server. */
export function recentErrors(entries: LogEntry[], limit = 50, includeNoise = false): LogEntry[] {
  return recentLogs(entries, { limit, level: 'error', includeNoise })
}

/** Every entry of one page load (browser + server), chronological - the full tree (noise included). */
export function logsForPage(entries: LogEntry[], pageLoadId: string): LogEntry[] {
  return entries.filter(e => e.pageLoadId === pageLoadId).sort(byTime)
}

/** Case-insensitive substring search across messages. Hides noise unless asked. */
export function search(entries: LogEntry[], query: string, limit = 50, includeNoise = false): LogEntry[] {
  const needle = query.toLowerCase()
  return entries
    .filter(e => e.message.toLowerCase().includes(needle) && (includeNoise || !e.noise))
    .sort(byTime)
    .slice(-limit)
}

/** Position marker for incremental reads: a timestamp plus how many entries at that exact ms were already consumed. */
export interface SinceCursor {
  ts: number
  tsCount: number
}

export interface SinceResult {
  fresh: LogEntry[]
  cursor: SinceCursor | null
}

function makeCursor(sorted: LogEntry[]): SinceCursor | null {
  const last = sorted[sorted.length - 1]
  if (!last) {
    return null
  }
  const ts = last.timestamp
  let tsCount = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]?.timestamp !== ts) {
      break
    }
    tsCount++
  }
  return { ts, tsCount }
}

/**
 * Entries that arrived since `cursor`. On the first call (cursor null) returns
 * the recent tail as a baseline. Tie-safe (handles multiple entries at the same
 * ms) and rotation-safe (dropped older entries are simply never re-reported).
 */
export function logsSince(entries: LogEntry[], cursor: SinceCursor | null, baselineLimit = 50): SinceResult {
  const sorted = [...entries].sort(byTime)
  if (cursor === null) {
    return { fresh: sorted.slice(-baselineLimit), cursor: makeCursor(sorted) }
  }
  let startIdx = sorted.length
  let consumedAtTs = 0
  for (let i = 0; i < sorted.length; i++) {
    const ts = sorted[i]?.timestamp
    if (ts === undefined) {
      continue
    }
    if (ts > cursor.ts) {
      startIdx = i
      break
    }
    if (ts === cursor.ts) {
      if (consumedAtTs < cursor.tsCount) {
        consumedAtTs++
        continue
      }
      startIdx = i
      break
    }
  }
  return { fresh: sorted.slice(startIdx), cursor: makeCursor(sorted) }
}
