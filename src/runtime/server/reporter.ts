import type { ConsolaReporter } from 'consola'
import type { NdjsonStore } from '../utils/ndjson-store'
import { toLogLevel, formatArgs, extractStack, isNoise } from '../utils/normalize'
import { currentRequestContext } from './request-context'

/**
 * consola reporter that normalises every server-side log into a `LogEntry`
 * and persists it. Never logs itself, to avoid a feedback loop.
 */
export function createReporter(store: NdjsonStore): ConsolaReporter {
  return {
    log(logObj) {
      const args = logObj.args ?? []
      const message = formatArgs(args)
      // The Nitro `error` hook captures these cleanly (with ids + stack); skip the duplicate.
      if (message.startsWith('[request error]')) {
        return
      }
      const { requestId, pageLoadId, route } = currentRequestContext()
      store.append({
        timestamp: logObj.date instanceof Date ? logObj.date.getTime() : Date.now(),
        level: toLogLevel(logObj.type),
        source: 'server',
        message,
        stack: extractStack(args),
        requestId,
        pageLoadId,
        route,
        noise: isNoise(message, 'server') || undefined,
      })
    },
  }
}
