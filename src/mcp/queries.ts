import { existsSync, readFileSync } from 'node:fs'
import type { LogEntry, LogLevel, LogSource } from '../runtime/types'

/** Read and parse the NDJSON store; malformed lines are skipped. */
export function readEntries(file: string): LogEntry[] {
  if (!existsSync(file)) {
    return []
  }
  const entries: LogEntry[] = []
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
  return entries
}

const byTime = (a: LogEntry, b: LogEntry): number => a.timestamp - b.timestamp

export interface RecentOptions {
  limit?: number
  level?: LogLevel
  source?: LogSource
  /** Only entries at or after this Unix epoch (ms). */
  since?: number
}

/** Most recent entries (chronological), with optional filters. */
export function recentLogs(entries: LogEntry[], options: RecentOptions = {}): LogEntry[] {
  const { limit = 50, level, source, since } = options
  const filtered = entries.filter(e =>
    (level === undefined || e.level === level)
    && (source === undefined || e.source === source)
    && (since === undefined || e.timestamp >= since),
  )
  return filtered.sort(byTime).slice(-limit)
}

/** The most recent errors from both browser and server. */
export function recentErrors(entries: LogEntry[], limit = 50): LogEntry[] {
  return recentLogs(entries, { limit, level: 'error' })
}

/** Every entry of one page load (browser + server), chronological - the full tree. */
export function logsForPage(entries: LogEntry[], pageLoadId: string): LogEntry[] {
  return entries.filter(e => e.pageLoadId === pageLoadId).sort(byTime)
}

/** Case-insensitive substring search across messages. */
export function search(entries: LogEntry[], query: string, limit = 50): LogEntry[] {
  const needle = query.toLowerCase()
  return entries.filter(e => e.message.toLowerCase().includes(needle)).sort(byTime).slice(-limit)
}
