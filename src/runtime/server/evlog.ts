import type { NdjsonStore } from '../utils/ndjson-store'
import { toLogLevel } from '../utils/normalize'
import { isUuid } from '../utils/correlation'

/**
 * Minimal shape of evlog's `evlog:drain` hook payload. Typed locally on purpose:
 * Spyglass never imports (or depends on) evlog. If evlog isn't installed the
 * hook simply never fires; if it is, this mirrors evlog's `DrainContext`.
 */
interface EvlogRequestLog {
  level: 'info' | 'warn'
  message: string
  timestamp?: string
}

interface EvlogWideEvent {
  timestamp?: string
  level?: string
  status?: number
  message?: string
  requestId?: string
  error?: unknown
  requestLogs?: EvlogRequestLog[]
  [key: string]: unknown
}

export interface EvlogDrainContext {
  event: EvlogWideEvent
  request?: { method?: string, path?: string, requestId?: string }
  headers?: Record<string, string>
}

// Wide-event keys that carry framing/internal data rather than user fields; kept
// out of the attributes we attach so the captured payload stays meaningful.
const FRAMING_KEYS = new Set([
  'timestamp', 'level', 'service', 'environment', 'version', 'commitHash',
  'region', 'audit', 'status', 'message', 'requestId', 'requestLogs', 'error',
])

/** Parse an ISO timestamp, falling back to a known-good value when absent/invalid. */
function toMillis(iso: string | undefined, fallback: number): number {
  if (iso) {
    const parsed = Date.parse(iso)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

function errorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack
  if (error && typeof error === 'object' && 'stack' in error) {
    const stack = (error as { stack?: unknown }).stack
    return typeof stack === 'string' ? stack : undefined
  }
  return undefined
}

/**
 * Translate one evlog wide event into Spyglass entries:
 *  - each per-request log (`requestLogs`) becomes its own entry, so individual
 *    `log.info/warn(...)` calls aren't lost inside the aggregate event;
 *  - the wide event itself becomes a request-summary entry carrying the
 *    structured fields (and the error stack, if any).
 *
 * Works regardless of evlog's console settings - we read the structured event,
 * not its rendered output. Correlation reuses the `x-spyglass-page` header when
 * the browser sent one (so evlog entries line up with the rest of the page
 * load), otherwise evlog's own request id.
 */
export function appendEvlogDrain(store: NdjsonStore, ctx: EvlogDrainContext): void {
  const { event, request, headers } = ctx
  const baseTs = toMillis(event.timestamp, Date.now())
  const requestId = request?.requestId ?? event.requestId
  const pageHeader = headers?.['x-spyglass-page']
  const pageLoadId = isUuid(pageHeader) ? pageHeader : requestId
  const route = request?.path

  for (const entry of event.requestLogs ?? []) {
    store.append({
      timestamp: toMillis(entry.timestamp, baseTs),
      level: toLogLevel(entry.level),
      source: 'server',
      message: entry.message,
      requestId,
      pageLoadId,
      route,
    })
  }

  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event)) {
    if (!FRAMING_KEYS.has(key)) fields[key] = value
  }

  const summary = request
    ? `${request.method ?? 'GET'} ${route ?? ''}${event.status ? ` -> ${event.status}` : ''}`.trim()
    : (event.message ?? 'event')

  store.append({
    timestamp: baseTs,
    level: toLogLevel(event.level ?? 'info'),
    source: 'server',
    message: `[evlog] ${summary}`,
    args: Object.keys(fields).length ? [fields] : undefined,
    stack: errorStack(event.error),
    requestId,
    pageLoadId,
    route,
  })
}
