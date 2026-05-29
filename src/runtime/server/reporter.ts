import { useEvent } from 'nitropack/runtime'
import type { ConsolaReporter } from 'consola'
import type { NdjsonStore } from '../utils/ndjson-store'
import { toLogLevel, formatArgs, extractStack } from '../utils/normalize'

/** Read the current request's id from Nitro's async context, if any. */
function currentRequestId(): string | undefined {
  try {
    return useEvent().context.spyglassRequestId as string | undefined
  }
  catch {
    // Logged outside a request (startup, background task) — no id.
    return undefined
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
      store.append({
        timestamp: logObj.date instanceof Date ? logObj.date.getTime() : Date.now(),
        level: toLogLevel(logObj.type),
        source: 'server',
        message: formatArgs(args),
        stack: extractStack(args),
        requestId: currentRequestId(),
      })
    },
  }
}
