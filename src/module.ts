import { defineNuxtModule, addPlugin, addImportsDir, createResolver } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Master switch. Spyglass is a dev-only tool and additionally bails out in
   * production builds regardless of this flag.
   */
  enabled?: boolean
  /** NDJSON log file, relative to the Nuxt build dir. */
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
    logFile: 'spyglass/logs.ndjson',
  },
  setup(options, nuxt) {
    // Dev-only tool: never ship capture into production builds.
    if (!nuxt.options.dev || options.enabled === false) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // Expose minimal state to the client; the log file path stays server-side.
    nuxt.options.runtimeConfig.public.spyglass = { enabled: true }
    nuxt.options.runtimeConfig.spyglass = { logFile: options.logFile }

    addImportsDir(resolver.resolve('./runtime/composables'))
    addPlugin({ src: resolver.resolve('./runtime/plugin'), mode: 'client' })
  },
})
