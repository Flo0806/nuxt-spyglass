import type { LogLevel, LogSource } from '../types'

// Framework/ambient noise markers. Experimental - deliberately small and
// conservative; tune against real projects. Misclassification only hides an
// entry from default queries (it's still stored and retrievable), never drops it.
const NOISE_PATTERNS: Record<LogSource, string[]> = {
  browser: ['[Vue warn]', 'Nuxt DevTools', 'is an experimental feature', '[vite]'],
  server: ['Vite server', 'Vite client', 'warmed up', 'Nuxt Nitro server built'],
}

/** Heuristic classification of framework/ambient noise. Experimental. */
export function isNoise(message: string, source: LogSource): boolean {
  return NOISE_PATTERNS[source].some(pattern => message.includes(pattern))
}

const LEVEL_BY_TYPE: Record<string, LogLevel> = {
  fatal: 'error',
  error: 'error',
  fail: 'error',
  warn: 'warn',
  log: 'log',
  info: 'info',
  success: 'info',
  ready: 'info',
  start: 'info',
  box: 'info',
  debug: 'debug',
  trace: 'debug',
  verbose: 'debug',
}

/** Map a consola log type (or browser console method) to our level set. */
export function toLogLevel(type: string): LogLevel {
  return LEVEL_BY_TYPE[type] ?? 'log'
}

/** JSON.stringify that never throws on circular structures. */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]'
        seen.add(val)
      }
      return val
    }) ?? String(value)
  }
  catch {
    return String(value)
  }
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g

/** Strip ANSI colour codes; consola/Nitro pre-format errors with them. */
function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '')
}

/** Render arbitrary log arguments into a single human-readable line. */
export function formatArgs(args: unknown[]): string {
  const text = args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message
      return safeStringify(arg)
    })
    .join(' ')
  return stripAnsi(text)
}

/** Pull the stack trace from the first Error among the arguments, if any. */
export function extractStack(args: unknown[]): string | undefined {
  const error = args.find((arg): arg is Error => arg instanceof Error)
  return error?.stack
}
