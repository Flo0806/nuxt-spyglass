/**
 * Severity of a captured entry. Mirrors the console methods we hook on the
 * client plus the generic `log` channel.
 */
export type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error'

/** Where an entry was captured. */
export type LogSource = 'browser' | 'server'

/**
 * A single normalised log record. Both the browser and server capture paths
 * produce this exact shape, so the store and the MCP layer stay
 * source-agnostic.
 */
export interface LogEntry {
  /** Unix epoch in milliseconds. */
  timestamp: number
  level: LogLevel
  source: LogSource
  /** Pre-rendered, human-readable message. */
  message: string
  /** Original arguments, serialised. Absent for non-console origins. */
  args?: unknown[]
  /** Stack trace, present on errors. */
  stack?: string
  /** Identifies a single server request; the finest correlation unit. */
  requestId?: string
  /** Groups everything of one page load (browser logs + the requests it made). */
  pageLoadId?: string
  /** Route path the entry originated from. */
  route?: string
  /** Framework/ambient noise (Vue warnings, devtools, build lifecycle); hidden from queries unless asked. */
  noise?: boolean
}
