import { isAbsolute, resolve } from 'node:path'
import { defineNuxtModule, addPlugin, addImportsDir, addServerPlugin, addServerHandler, createResolver, useLogger } from '@nuxt/kit'
import { detectMcpRegistration } from './shared/mcp-registration'

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
  /** Print the MCP connection state and setup command on startup. */
  mcpHint?: boolean
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
    mcpHint: true,
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

    // Both bins find this project's log file themselves, so the commands carry no
    // paths - which is what makes the MCP registration a one-time, global thing.
    const logger = useLogger('spyglass')
    logger.info(`active - logging to ${logFile}`)

    if (options.mcpHint !== false) {
      const scope = detectMcpRegistration(nuxt.options.rootDir)
      if (scope === 'user') {
        logger.success('MCP connected (user scope - available in every project)')
      }
      else if (scope === 'project') {
        logger.success('MCP connected (project scope via .mcp.json)')
      }
      else if (scope === 'local') {
        logger.success('MCP connected for this project (`--scope user` would make it global)')
      }
      else {
        // Only Claude Code's config is readable, so "not found" may simply mean
        // "another client" - phrase it as an offer, not as a problem.
        logger.info('MCP server for AI agents: npx -p nuxt-spyglass nuxt-spyglass-mcp\n'
          + '  Claude Code, once for every project:  claude mcp add --scope user spyglass -- npx -y -p nuxt-spyglass nuxt-spyglass-mcp\n'
          + '  Already set up elsewhere? Silence this with spyglass: { mcpHint: false }')
      }
    }

    logger.info('live log viewer:  npx nuxt-spyglass')
  },
})
