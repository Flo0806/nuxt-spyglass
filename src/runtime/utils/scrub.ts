import type { LogEntry } from '../types'

/**
 * Best-effort secret redaction. Spyglass is dev-only and writes to a local file,
 * but logs routinely contain headers, tokens and credentials - we never want
 * those persisted (and handed to an AI agent) in clear text. Isomorphic: the
 * same scrubbing runs on the server reporter and on browser-ingested entries.
 *
 * This is a safety net, not a guarantee - it targets common shapes, erring on
 * the side of over-redaction.
 */

const REDACTED = '[redacted]'

// Object keys whose value is always sensitive regardless of content.
const SENSITIVE_KEY
  = /^(?:authorization|cookie|set-cookie|x-api-key|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|client[-_]?secret|secret|password|passwd|pwd|token|private[-_]?key|session[-_]?id)$/i

// `key: value` / `key=value` / `"key":"value"` inside free-form text (JSON, query
// strings). `authorization`/`cookie` are handled by BEARER and by key-name redaction,
// so they're left out here to avoid mangling an already-redacted value.
const KEY_VALUE
  = /\b(api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|client[-_]?secret|secret|password|passwd|pwd|token|private[-_]?key)(["']?\s*[:=]\s*)(["']?)[^\s"',;&]+\3/gi

const BEARER = /\bBearer\s+[\w.\-~+/]+=*/gi
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g

// Provider token shapes with distinctive prefixes.
const TOKEN_PATTERNS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub
  /\bgithub_pat_\w{20,}\b/g, // GitHub fine-grained PAT
  /\bsk-[A-Za-z0-9]{20,}\b/g, // OpenAI
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, // Stripe
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
]

/** Redact secret-looking substrings from a single string. */
export function scrubString(text: string): string {
  let out = text
  out = out.replace(BEARER, `Bearer ${REDACTED}`)
  out = out.replace(JWT, REDACTED)
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, REDACTED)
  }
  out = out.replace(KEY_VALUE, (_m, key, sep, quote) => `${key}${sep}${quote}${REDACTED}${quote}`)
  return out
}

/** Deep-redact a value: sensitive keys by name, secret-looking strings by shape. */
export function scrubValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') {
    return scrubString(value)
  }
  if (Array.isArray(value)) {
    return value.map(item => scrubValue(item, seen))
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(val, seen)
    }
    return result
  }
  return value
}

/** Redact the human-facing fields of a log entry before it is persisted. */
export function scrubEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    message: scrubString(entry.message),
    ...(entry.args ? { args: scrubValue(entry.args) as unknown[] } : {}),
    ...(entry.stack ? { stack: scrubString(entry.stack) } : {}),
    ...(entry.route ? { route: scrubString(entry.route) } : {}),
  }
}
