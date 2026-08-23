import { useEvent } from 'nitropack/runtime'
import type { ConsolaReporter } from 'consola'
import type { NdjsonStore } from '../utils/ndjson-store'
import { toLogLevel, formatArgs, extractStack, isNoise } from '../utils/normalize'

/** Read the current request's correlation ids and route from Nitro's async context, if any. */
function currentContext(): { requestId?: string, pageLoadId?: string, route?: string } {
  try {
    const event = useEvent()
    return {
      requestId: event.context.spyglassRequestId as string | undefined,
      pageLoadId: event.context.spyglassPageLoadId as string | undefined,
      route: event.path,
    }
  }
  catch {
    // Logged outside a request (startup, background task) - no context.
    return {}
  }
}

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
      const { requestId, pageLoadId, route } = currentContext()
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
