import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import type { ObjectPlugin } from '#app'
import type { LogEntry, LogLevel } from './types'
import { formatArgs, extractStack } from './utils/normalize'

const INGEST_URL = '/_spyglass/ingest'
const FLUSH_INTERVAL = 2000
/** Ship promptly during bursts so a single batch never grows unwieldy. */
const FLUSH_THRESHOLD = 50

/** Adopt the page id the server injected, or mint one for non-SSR loads. */
function resolvePageLoadId(): string {
  const injected = document.querySelector('meta[name="spyglass-page"]')?.getAttribute('content')
  return injected || crypto.randomUUID()
}

/** True for same-origin requests only - never leak the correlation header to third parties. */
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
const plugin: ObjectPlugin = defineNuxtPlugin(() => {
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
    // A burst (e.g. on route change) must not pile up into one huge request.
    if (buffer.length >= FLUSH_THRESHOLD) {
      flush()
    }
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
  const call = realFetch as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>
  const wrapped = (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
    if (isSameOrigin(input)) {
      const headers = new Headers(init?.headers)
      headers.set('x-spyglass-page', pageLoadId)
      return call(input, { ...init, headers })
    }
    return call(input, init)
  }
  Object.assign(wrapped, realFetch)
  globalThis.$fetch = wrapped as unknown as typeof globalThis.$fetch

  const flush = (): void => {
    if (buffer.length === 0) {
      return
    }
    const batch = buffer.splice(0, buffer.length)
    // Plain fetch and swallow failures: logging must never disrupt the app.
    // NOT `keepalive` - that caps the *combined* in-flight body at 64 KB, so a
    // burst silently loses the whole batch. keepalive belongs only on the
    // pagehide path below, where the request must outlive the page.
    nativeFetch(INGEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
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

export default plugin
