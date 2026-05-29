import { randomUUID } from 'node:crypto'
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { getRequestHeader } from 'h3'
import { consola } from 'consola'
import { createNdjsonStore } from '../utils/ndjson-store'
import { createReporter } from './reporter'
import type { SpyglassNitroApp } from './shared'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only trust a client-supplied page id if it is a real UUID (avoids HTML injection). */
function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Registers Spyglass' consola reporter, routes plain `console.*` calls through
 * consola, exposes the shared store, and tags each request for correlation.
 */
export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig() as unknown as { spyglass?: { logFile: string } }
  const logFile = config.spyglass?.logFile

  if (!logFile) {
    return
  }

  const store = createNdjsonStore(logFile)
  consola.addReporter(createReporter(store))
  consola.wrapConsole()

  ;(nitroApp as SpyglassNitroApp).spyglassStore = store

  // Per request: a unique requestId, plus the pageLoadId carried by the client
  // (falls back to the requestId, which makes an SSR document its own page root).
  nitroApp.hooks.hook('request', (event) => {
    const requestId = randomUUID()
    const header = getRequestHeader(event, 'x-spyglass-page')
    event.context.spyglassRequestId = requestId
    event.context.spyglassPageLoadId = isUuid(header) ? header : requestId
  })

  // Hand the page id to the browser so it adopts the same id for its own logs.
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const pageLoadId = event.context.spyglassPageLoadId
    if (pageLoadId) {
      html.head.push(`<meta name="spyglass-page" content="${pageLoadId}">`)
    }
  })
})
