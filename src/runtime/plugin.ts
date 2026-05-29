import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import type { LogEntry, LogLevel } from './types'
import { formatArgs, extractStack } from './utils/normalize'

const INGEST_URL = '/_spyglass/ingest'
const FLUSH_INTERVAL = 2000

/**
 * Client entry point: captures browser logs and errors, buffers them and ships
 * batches to the Nitro ingest endpoint, which persists them to the shared store.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public.spyglass as { enabled: boolean } | undefined
  if (!config?.enabled) {
    return
  }

  const buffer: LogEntry[] = []

  const capture = (level: LogLevel, args: unknown[]): void => {
    buffer.push({
      timestamp: Date.now(),
      level,
      source: 'browser',
      message: formatArgs(args),
      stack: extractStack(args),
      route: window.location.pathname,
    })
  }

  const levels: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug']
  for (const level of levels) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      capture(level, args)
    }
  }

  window.addEventListener('error', (event) => {
    capture('error', [event.error instanceof Error ? event.error : event.message])
  })
  window.addEventListener('unhandledrejection', (event) => {
    capture('error', [event.reason instanceof Error ? event.reason : String(event.reason)])
  })

  const flush = (): void => {
    if (buffer.length === 0) {
      return
    }
    const batch = buffer.splice(0, buffer.length)
    // Swallow failures: shipping logs must never disrupt the app being observed.
    fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {})
  }

  setInterval(flush, FLUSH_INTERVAL)

  // Best-effort final flush when the page goes away.
  window.addEventListener('pagehide', () => {
    if (buffer.length === 0) {
      return
    }
    const batch = buffer.splice(0, buffer.length)
    navigator.sendBeacon(INGEST_URL, new Blob([JSON.stringify(batch)], { type: 'application/json' }))
  })
})
