import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { consola } from 'consola'
import { createNdjsonStore } from '../utils/ndjson-store'
import { createReporter } from './reporter'

/**
 * Registers Spyglass' consola reporter and routes plain `console.*` calls
 * through consola, so server logs land in the NDJSON store.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig() as unknown as { spyglass?: { logFile: string } }
  const logFile = config.spyglass?.logFile

  if (!logFile) {
    return
  }

  const store = createNdjsonStore(logFile)
  consola.addReporter(createReporter(store))
  consola.wrapConsole()
})
