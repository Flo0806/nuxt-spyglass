import { defineEventHandler, readBody } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import type { LogEntry, LogLevel } from '../types'
import { isNoise } from '../utils/normalize'
import type { SpyglassNitroApp } from './shared'

const LEVELS: LogLevel[] = ['debug', 'info', 'log', 'warn', 'error']

/** Coerce an untrusted browser payload entry into a safe `LogEntry`. */
function toEntry(raw: Partial<LogEntry>): LogEntry {
  const message = typeof raw.message === 'string' ? raw.message : ''
  return {
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    level: LEVELS.includes(raw.level as LogLevel) ? raw.level as LogLevel : 'log',
    source: 'browser',
    message,
    stack: typeof raw.stack === 'string' ? raw.stack : undefined,
    route: typeof raw.route === 'string' ? raw.route : undefined,
    pageLoadId: typeof raw.pageLoadId === 'string' ? raw.pageLoadId : undefined,
    noise: isNoise(message, 'browser') || undefined,
  }
}

/** Receives batched browser logs and appends them to the shared store. */
export default defineEventHandler(async (event) => {
  const store = (useNitroApp() as SpyglassNitroApp).spyglassStore
  if (!store) {
    return { ok: false }
  }

  const body = await readBody<Partial<LogEntry>[]>(event)
  if (!Array.isArray(body)) {
    return { ok: false }
  }

  for (const raw of body) {
    store.append(toEntry(raw))
  }

  return { ok: true }
})
