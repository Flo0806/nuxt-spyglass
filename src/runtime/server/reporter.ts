import { useEvent } from 'nitropack/runtime'
import type { ConsolaReporter } from 'consola'
import type { NdjsonStore } from '../utils/ndjson-store'
import { toLogLevel, formatArgs, extractStack } from '../utils/normalize'

/** Read the current request's correlation ids from Nitro's async context, if any. */
function currentIds(): { requestId?: string, pageLoadId?: string } {
  try {
    const { context } = useEvent()
    return {
      requestId: context.spyglassRequestId as string | undefined,
      pageLoadId: context.spyglassPageLoadId as string | undefined,
    }
  }
  catch {
    // Logged outside a request (startup, background task) — no ids.
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
      const { requestId, pageLoadId } = currentIds()
      store.append({
        timestamp: logObj.date instanceof Date ? logObj.date.getTime() : Date.now(),
        level: toLogLevel(logObj.type),
        source: 'server',
        message: formatArgs(args),
        stack: extractStack(args),
        requestId,
        pageLoadId,
      })
    },
  }
}
