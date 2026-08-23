import { useEvent } from 'nitropack/runtime'

export interface RequestContext {
  requestId?: string
  pageLoadId?: string
  /** Path of the request currently being handled. */
  route?: string
}

/**
 * Correlation ids of the request being handled right now, read from Nitro's
 * async context. Every capture path must prefer these over ids of its own, so
 * entries of one request line up no matter which path produced them.
 */
export function currentRequestContext(): RequestContext {
  try {
    const event = useEvent()
    return {
      requestId: event.context.spyglassRequestId as string | undefined,
      pageLoadId: event.context.spyglassPageLoadId as string | undefined,
      route: event.path,
    }
  }
  catch {
    // Outside a request (startup, background task) there is nothing to read.
    return {}
  }
}
