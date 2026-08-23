#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import type { LogEntry } from '../runtime/types'
import { readEntries, recentLogs, recentErrors, logsForPage, search, logsSince, summarize } from './queries'
import type { SinceCursor } from './queries'
import { createLogFileResolver } from '../shared/log-file'

// The client spawns us with its working directory set to the open project, so a
// path argument is optional: without one we find the project's log ourselves.
const resolveLogFile = createLogFileResolver(process.argv[2])

/** Render one entry as compact, model-friendly text. */
function formatEntry(entry: LogEntry): string {
  const time = new Date(entry.timestamp).toISOString()
  const ids = [
    entry.pageLoadId && `page=${entry.pageLoadId.slice(0, 8)}`,
    entry.requestId && `req=${entry.requestId.slice(0, 8)}`,
    entry.route && `route=${entry.route}`,
  ].filter(Boolean).join(' ')
  const lines = [`${time} ${entry.level.toUpperCase()} [${entry.source}] ${ids}`.trimEnd(), `  ${entry.message}`]
  if (entry.stack) {
    lines.push(entry.stack.split('\n').slice(0, 4).map(l => `  ${l}`).join('\n'))
  }
  return lines.join('\n')
}

function text(value: string): CallToolResult {
  return { content: [{ type: 'text', text: value }] }
}

function render(entries: LogEntry[]): CallToolResult {
  return text(entries.length === 0 ? 'No matching log entries.' : entries.map(formatEntry).join('\n'))
}

/**
 * Run a query against the current project's log file. Resolution happens per
 * call because the dev server is often started after the AI client.
 */
function withEntries(run: (entries: LogEntry[]) => CallToolResult): CallToolResult {
  const resolved = resolveLogFile()
  if (!resolved.file) {
    return text(
      `No Spyglass log file found under ${resolved.searchRoot}.\n`
      + 'Start the Nuxt dev server of the project you are working on - nuxt-spyglass writes to '
      + '.data/spyglass/logs.ndjson - then try again.',
    )
  }
  return run(readEntries(resolved.file))
}

const DEFAULT_LOG_LAYOUT = join('.data', 'spyglass', 'logs.ndjson')

const LIMIT = z.number().int().positive().max(500).optional()
const INCLUDE_NOISE = z.boolean().optional().describe(
  'Include framework/ambient noise (Vue warnings, devtools, build lifecycle). Default: excluded. Set true to see everything, e.g. to reason about timing/ordering.',
)

// Clients pass these instructions to the model. Without them an agent has no
// reason to suspect that live logs are available at all.
const INSTRUCTIONS = [
  'This directory is a Nuxt project running nuxt-spyglass: every browser log (console.*, uncaught errors,',
  'unhandled rejections) and every server log (Nitro/SSR, thrown errors) of the running dev server is captured',
  'in one file, correlated per page load. Read them instead of guessing or asking the user to paste logs.',
  '',
  'The user reports something broken -> recent_errors.',
  'You changed code and want to know what the app did next -> logs_since_last_check.',
  'You have a pageLoadId and want the full browser+server story -> logs_for_page.',
  'You are unsure which project these logs belong to, or a query came back empty -> spyglass_status.',
].join('\n')

const server = new McpServer({ name: 'nuxt-spyglass', version: '1.0.0' }, { instructions: INSTRUCTIONS })

server.registerTool('recent_errors', {
  description: 'The fastest way to find out what broke: the most recent errors from browser and server, with stack traces. Start here whenever the user says something is broken, blank, failing or behaving oddly. Framework noise is excluded by default; set includeNoise to see everything.',
  inputSchema: { limit: LIMIT, includeNoise: INCLUDE_NOISE },
}, ({ limit, includeNoise }) => withEntries(entries => render(recentErrors(entries, limit ?? 50, includeNoise))))

server.registerTool('recent_logs', {
  description: 'Recent log entries, optionally filtered by level, source (browser or server) and start time. Use it for the context around an error, or to see what the app did during a specific window. Framework noise is excluded by default; set includeNoise to see everything.',
  inputSchema: {
    limit: LIMIT,
    level: z.enum(['debug', 'info', 'log', 'warn', 'error']).optional(),
    source: z.enum(['browser', 'server']).optional(),
    since: z.number().int().optional().describe('Unix epoch in ms; only entries at or after this time'),
    includeNoise: INCLUDE_NOISE,
  },
}, ({ limit, level, source, since, includeNoise }) => withEntries(entries => render(recentLogs(entries, { limit, level, source, since, includeNoise }))))

server.registerTool('logs_for_page', {
  description: 'Every log of one page load by pageLoadId, browser and server interleaved - the full correlated story, noise included. Use it after another tool gave you a pageLoadId, typically to find the server request behind a client-side error.',
  inputSchema: { pageLoadId: z.string(), limit: LIMIT },
}, ({ pageLoadId, limit }) => withEntries((entries) => {
  // A busy page load can hold thousands of entries; never flood the caller.
  const all = logsForPage(entries, pageLoadId)
  const shown = all.slice(-(limit ?? 200))
  if (shown.length === 0) {
    return text('No matching log entries.')
  }
  const note = shown.length < all.length ? `(the last ${shown.length} of ${all.length} entries)\n` : ''
  return text(note + shown.map(formatEntry).join('\n'))
}))

server.registerTool('search', {
  description: 'Case-insensitive substring search across log messages. Use it when you know a marker to look for - a message, an id, a route, a component name. Framework noise is excluded by default; set includeNoise to see everything.',
  inputSchema: { query: z.string(), limit: LIMIT, includeNoise: INCLUDE_NOISE },
}, ({ query, limit, includeNoise }) => withEntries(entries => render(search(entries, query, limit ?? 50, includeNoise))))

function ago(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) {
    return `${seconds}s ago`
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ago`
  }
  return `${Math.round(seconds / 3600)}h ago`
}

/**
 * `<project>/.data/spyglass/logs.ndjson` - three levels up is the project root.
 * Only meaningful for the default layout; a custom log path tells us nothing.
 */
function projectRoot(file: string): string | null {
  return file.endsWith(DEFAULT_LOG_LAYOUT) ? dirname(dirname(dirname(file))) : null
}

server.registerTool('spyglass_status', {
  description: 'Which project\'s logs you are about to read, and whether its dev server is still running. Call this when you are unsure where the logs come from, when the user works across several projects, or when a query comes back empty and you want to know whether that means "no errors" or "no logs at all".',
  inputSchema: {},
}, () => {
  const resolved = resolveLogFile()
  if (!resolved.file) {
    return text(
      `No Spyglass log file found under ${resolved.searchRoot}.\n`
      + 'Either no Nuxt dev server with nuxt-spyglass is running here, or this is not a Spyglass project.',
    )
  }

  const origin = resolved.source === 'discovered'
    ? `discovered under ${resolved.searchRoot}`
    : resolved.source === 'env'
      ? 'taken from SPYGLASS_LOG_FILE'
      : 'given as a command line argument'

  if (!existsSync(resolved.file)) {
    return text(`Log file: ${resolved.file} (${origin})\nThe file does not exist yet - the dev server has not written anything.`)
  }

  const summary = summarize(readEntries(resolved.file))
  const levels = Object.entries(summary.byLevel).map(([level, count]) => `${count} ${level}`).join(', ')
  const sources = Object.entries(summary.bySource).map(([source, count]) => `${count} ${source}`).join(', ')

  const root = projectRoot(resolved.file)
  const lines = [
    ...(root ? [`Project:  ${root}`] : []),
    `Log file: ${resolved.file} (${origin})`,
    `Entries:  ${summary.total} (${summary.noise} framework noise, hidden unless includeNoise is set)`,
    `Levels:   ${levels || 'none'}`,
    `Sources:  ${sources || 'none'}`,
  ]
  if (summary.lastTimestamp !== undefined) {
    const idle = Date.now() - summary.lastTimestamp > 60_000
    lines.push(`Newest:   ${ago(summary.lastTimestamp)}${idle ? ' - dev server may be stopped, logs could be stale' : ' - dev server is active'}`)
  }
  if (resolved.candidates.length > 1) {
    const others = resolved.candidates.slice(1).map(c => `  ${c.file} (${ago(c.mtimeMs)})`).join('\n')
    lines.push(`Also found (not used, older):\n${others}`)
  }
  return text(lines.join('\n'))
})

// Stateful, non-blocking "notify": each call returns only what arrived since the
// previous call in this session. The cursor lives for the process lifetime.
let sinceCursor: SinceCursor | null = null
server.registerTool('logs_since_last_check', {
  description: 'Only what arrived since your previous call to this tool (the first call returns the recent tail as a baseline). This is the tool to reach for after you changed code or asked the user to click something: it shows what the app did in response, without re-reading logs you have already seen. Framework noise excluded by default.',
  inputSchema: { includeNoise: INCLUDE_NOISE },
}, ({ includeNoise }) => withEntries((entries) => {
  const { fresh, cursor } = logsSince(entries, sinceCursor)
  sinceCursor = cursor
  return render(includeNoise ? fresh : fresh.filter(e => !e.noise))
}))

// stderr goes to the client's MCP log, which is where a user looks when the
// server seems to be reading the wrong project.
const startup = resolveLogFile()
process.stderr.write(startup.file
  ? `nuxt-spyglass-mcp: reading ${startup.file}\n`
  : `nuxt-spyglass-mcp: no log file found under ${startup.searchRoot} yet - waiting for a dev server\n`)

await server.connect(new StdioServerTransport())
