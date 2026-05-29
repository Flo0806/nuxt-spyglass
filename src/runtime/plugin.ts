import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import type { LogEntry, LogLevel } from './types'
import { formatArgs, extractStack } from './utils/normalize'

const INGEST_URL = '/_spyglass/ingest'
const FLUSH_INTERVAL = 2000

/** Adopt the page id the server injected, or mint one for non-SSR loads. */
function resolvePageLoadId(): string {
  const injected = document.querySelector('meta[name="spyglass-page"]')?.getAttribute('content')
  return injected || crypto.randomUUID()
}

/** True for same-origin requests only — never leak the correlation header to third parties. */
function isSameOrigin(request: unknown): boolean {
  try {
    const url = request instanceof Request
      ? new URL(request.url)
      : new URL(request as string | URL, location.origin)
    return url.origin === location.origin
  }
  catch {
    return false
  }
}

/**
 * Client entry point: captures browser logs and errors, tags them with the
 * page load id, and ships batches to the Nitro ingest endpoint. Also stamps
 * outgoing same-origin `$fetch` requests so the server can correlate them.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public.spyglass as { enabled: boolean } | undefined
  if (!config?.enabled) {
    return
  }

  const pageLoadId = resolvePageLoadId()
  const nativeFetch = window.fetch.bind(window)
  const buffer: LogEntry[] = []

  const capture = (level: LogLevel, args: unknown[]): void => {
    buffer.push({
      timestamp: Date.now(),
      level,
      source: 'browser',
      message: formatArgs(args),
      stack: extractStack(args),
      route: window.location.pathname,
      pageLoadId,
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

  // Wrap $fetch (delegating to the real one) so same-origin calls carry the page id.
  const realFetch = globalThis.$fetch
  const wrapped = ((request: Parameters<typeof realFetch>[0], options: Parameters<typeof realFetch>[1] = {}) => {
    if (isSameOrigin(request)) {
      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set('x-spyglass-page', pageLoadId)
      options = { ...options, headers }
    }
    return realFetch(request, options)
  }) as typeof realFetch
  Object.assign(wrapped, realFetch)
  globalThis.$fetch = wrapped

  const flush = (): void => {
    if (buffer.length === 0) {
      return
    }
    const batch = buffer.splice(0, buffer.length)
    // Use native fetch and swallow failures: logging must never disrupt the app.
    nativeFetch(INGEST_URL, {
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
