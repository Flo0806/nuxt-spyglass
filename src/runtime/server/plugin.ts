import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { consola } from 'consola'
import { createNdjsonStore } from '../utils/ndjson-store'
import { createReporter } from './reporter'
import type { SpyglassNitroApp } from './shared'

/**
 * Registers Spyglass' consola reporter, routes plain `console.*` calls through
 * consola, and exposes the shared store so the browser-ingest handler writes
 * to the same file and write-queue.
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
})
