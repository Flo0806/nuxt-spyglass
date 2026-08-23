import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import type { ObjectPlugin } from '#app'
import type { LogEntry, LogLevel } from './types'
import { formatArgs, extractStack } from './utils/normalize'

const INGEST_URL = '/_spyglass/ingest'
const PAGE_HEADER = 'x-spyglass-page'
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
    // Cross-origin scripts report neither an Error nor a useful message; keep the
    // entry readable instead of storing an empty one.
    capture('error', [event.error instanceof Error ? event.error : (event.message || 'Uncaught error (no details available)')])
  })
  window.addEventListener('unhandledrejection', (event) => {
    capture('error', [event.reason instanceof Error ? event.reason : String(event.reason)])
  })

  // Stamp outgoing same-origin requests with the page id so the server can tie
  // its logs to this page load. `window.fetch` is the interception point that
  // holds across Nuxt versions: ofetch - and with it `$fetch`, `useFetch` and
  // `useAsyncData` - resolves `globalThis.fetch` per call, so every request goes
  // through this patch no matter which `$fetch` binding the app ended up with.
  // (Nuxt 4.5 turned `$fetch` from a runtime global into a frozen module import,
  // which silently bypassed the wrapper below.) Our own ingest calls use the
  // captured `nativeFetch` and therefore stay untagged.
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      if (!isSameOrigin(input)) {
        return nativeFetch(input, init)
      }
      if (input instanceof Request) {
        const request = new Request(input, init)
        request.headers.set(PAGE_HEADER, pageLoadId)
        return nativeFetch(request)
      }
      const headers = new Headers(init?.headers)
      headers.set(PAGE_HEADER, pageLoadId)
      return nativeFetch(input, { ...init, headers })
    }
    catch {
      // Correlation must never break an actual request.
      return nativeFetch(input, init)
    }
  }

  // Older Nuxt versions expose `$fetch` as a true global; keep wrapping it for
  // those. Harmless where the fetch patch already stamped the request - the
  // header is set to the same value either way.
  const realFetch = globalThis.$fetch
  const call = realFetch as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>
  const wrapped = (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
    if (isSameOrigin(input)) {
      const headers = new Headers(init?.headers)
      headers.set(PAGE_HEADER, pageLoadId)
      return call(input, { ...init, headers })
    }
    return call(input, init)
  }
  Object.assign(wrapped, realFetch)
  globalThis.$fetch = wrapped as unknown as typeof globalThis.$fetch

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
