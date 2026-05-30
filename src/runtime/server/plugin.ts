import { randomUUID } from 'node:crypto'
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { getRequestHeader } from 'h3'
import { consola } from 'consola'
import { createNdjsonStore } from '../utils/ndjson-store'
import { isUuid } from '../utils/correlation'
import { createReporter } from './reporter'
import { appendEvlogDrain, type EvlogDrainContext } from './evlog'
import type { SpyglassNitroApp } from './shared'

/**
 * Registers Spyglass' consola reporter, routes plain `console.*` calls through
 * consola, exposes the shared store, and tags each request for correlation.
 */
export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig() as unknown as { spyglass?: { logFile: string, maxFileSize?: number } }
  const logFile = config.spyglass?.logFile

  if (!logFile) {
    return
  }

  const store = createNdjsonStore(logFile, { maxFileSize: config.spyglass?.maxFileSize })
  consola.addReporter(createReporter(store))
  consola.wrapConsole()

  ;(nitroApp as SpyglassNitroApp).spyglassStore = store

  // evlog integration: apps using evlog emit one structured "wide event" per
  // request through this Nitro hook. Listening here captures evlog's logs even
  // in its console-less default (we read the event, not its rendered output) -
  // and client logs too, once the user enables evlog's transport (those POST to
  // /api/_evlog/ingest, which runs through this same hook). A harmless no-op
  // when evlog isn't installed. evlog augments Nitro's hook types, which we
  // deliberately don't import, hence the precise typed cast.
  ;(nitroApp.hooks as unknown as {
    hook(name: 'evlog:drain', cb: (ctx: EvlogDrainContext) => void): void
  }).hook('evlog:drain', ctx => appendEvlogDrain(store, ctx))

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

  // Capture unhandled errors here, where the event (and its ids) are available
  // and the original Error object yields a clean stack. consola logs the same
  // error outside the request context, so the reporter skips that duplicate.
  nitroApp.hooks.hook('error', (error, { event }) => {
    store.append({
      timestamp: Date.now(),
      level: 'error',
      source: 'server',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event?.context.spyglassRequestId as string | undefined,
      pageLoadId: event?.context.spyglassPageLoadId as string | undefined,
      route: event?.path,
    })
  })
})
