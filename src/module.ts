import { isAbsolute, resolve } from 'node:path'
import { defineNuxtModule, addPlugin, addImportsDir, addServerPlugin, addServerHandler, createResolver, useLogger } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Master switch. Spyglass is a dev-only tool and additionally bails out in
   * production builds regardless of this flag.
   */
  enabled?: boolean
  /** NDJSON log file. Relative paths are resolved against the project root. */
  logFile?: string
  /** Rotate once the active log reaches this many bytes (keeps at most two files). */
  maxFileSize?: number
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
    maxFileSize: 5 * 1024 * 1024,
  },
  setup(options, nuxt) {
    // Dev-only tool: never ship capture into production builds.
    if (!nuxt.options.dev || options.enabled === false) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // Request-scoped server logging needs Nitro's async context (useEvent).
    nuxt.options.nitro ||= {}
    nuxt.options.nitro.experimental ||= {}
    nuxt.options.nitro.experimental.asyncContext = true

    // Resolve to an absolute path; relative paths sit under the project root.
    const relative = options.logFile ?? '.data/spyglass/logs.ndjson'
    const logFile = isAbsolute(relative) ? relative : resolve(nuxt.options.rootDir, relative)

    // Expose minimal state to the client; the log file path stays server-side.
    // RuntimeConfig types are auto-generated and can lag while a dev server runs; cast our own keys.
    const runtimeConfig = nuxt.options.runtimeConfig as unknown as { public: Record<string, unknown>, [key: string]: unknown }
    runtimeConfig.public.spyglass = { enabled: true }
    runtimeConfig.spyglass = { logFile, maxFileSize: options.maxFileSize ?? 5 * 1024 * 1024 }

    addImportsDir(resolver.resolve('./runtime/composables'))
    addPlugin({ src: resolver.resolve('./runtime/plugin'), mode: 'client' })
    addServerPlugin(resolver.resolve('./runtime/server/plugin'))
    addServerHandler({
      route: '/_spyglass/ingest',
      method: 'post',
      handler: resolver.resolve('./runtime/server/ingest.post'),
    })

    // Confirm it's active, where logs go, and how to view them - the human CLI
    // viewer and the (per-agent) MCP setup are both documented in the README.
    const logger = useLogger('spyglass')
    logger.info(`active - logging to ${logFile}`)
    logger.info(`live log viewer: npx nuxt-spyglass ${logFile}`)
    logger.info('AI access via MCP - see the README')
  },
})
