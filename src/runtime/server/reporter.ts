import type { ConsolaReporter } from 'consola'
import type { NdjsonStore } from '../utils/ndjson-store'
import { toLogLevel, formatArgs, extractStack } from '../utils/normalize'

/**
 * consola reporter that normalises every server-side log into a `LogEntry`
 * and persists it. Never logs itself, to avoid a feedback loop.
 */
export function createReporter(store: NdjsonStore): ConsolaReporter {
  return {
    log(logObj) {
      const args = logObj.args ?? []
      store.append({
        timestamp: logObj.date instanceof Date ? logObj.date.getTime() : Date.now(),
        level: toLogLevel(logObj.type),
        source: 'server',
        message: formatArgs(args),
        stack: extractStack(args),
      })
    },
  }
}
