import type { LogLevel } from '../types'

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

/** Render arbitrary log arguments into a single human-readable line. */
export function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message
      return safeStringify(arg)
    })
    .join(' ')
}

/** Pull the stack trace from the first Error among the arguments, if any. */
export function extractStack(args: unknown[]): string | undefined {
  const error = args.find((arg): arg is Error => arg instanceof Error)
  return error?.stack
}
