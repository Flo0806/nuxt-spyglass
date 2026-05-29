import { isAbsolute, resolve } from 'node:path'
import { defineNuxtModule, addPlugin, addImportsDir, addServerPlugin, createResolver } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Master switch. Spyglass is a dev-only tool and additionally bails out in
   * production builds regardless of this flag.
   */
  enabled?: boolean
  /** NDJSON log file. Relative paths are resolved against the project root. */
  logFile?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-spyglass',
    configKey: 'spyglass',
    compatibility: {
      nuxt: '>=4.0.0',
    },
  },
  defaults: {
    enabled: true,
    logFile: '.data/spyglass/logs.ndjson',
  },
  setup(options, nuxt) {
    // Dev-only tool: never ship capture into production builds.
    if (!nuxt.options.dev || options.enabled === false) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // Resolve to an absolute path; relative paths sit under the project root.
    const relative = options.logFile ?? '.data/spyglass/logs.ndjson'
    const logFile = isAbsolute(relative) ? relative : resolve(nuxt.options.rootDir, relative)

    // Expose minimal state to the client; the log file path stays server-side.
    nuxt.options.runtimeConfig.public.spyglass = { enabled: true }
    nuxt.options.runtimeConfig.spyglass = { logFile }

    addImportsDir(resolver.resolve('./runtime/composables'))
    addPlugin({ src: resolver.resolve('./runtime/plugin'), mode: 'client' })
    addServerPlugin(resolver.resolve('./runtime/server/plugin'))
  },
})
