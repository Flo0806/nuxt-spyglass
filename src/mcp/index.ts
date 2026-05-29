#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type { LogEntry } from '../runtime/types'
import { readEntries, recentLogs, recentErrors, logsForPage, search } from './queries'

const logFile = process.argv[2] ?? process.env.SPYGLASS_LOG_FILE
if (!logFile) {
  process.stderr.write('nuxt-spyglass-mcp: missing log file path (pass it as the first argument)\n')
  process.exit(1)
}

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

function render(entries: LogEntry[]): { content: { type: 'text', text: string }[] } {
  const text = entries.length === 0 ? 'No matching log entries.' : entries.map(formatEntry).join('\n')
  return { content: [{ type: 'text', text }] }
}

const LIMIT = z.number().int().positive().max(500).optional()

const server = new McpServer({ name: 'nuxt-spyglass', version: '1.0.0' })

server.registerTool('recent_errors', {
  description: 'Most recent error logs from both browser and server.',
  inputSchema: { limit: LIMIT },
}, ({ limit }) => render(recentErrors(readEntries(logFile), limit ?? 50)))

server.registerTool('recent_logs', {
  description: 'Most recent logs, with optional filters by level, source and start time.',
  inputSchema: {
    limit: LIMIT,
    level: z.enum(['debug', 'info', 'log', 'warn', 'error']).optional(),
    source: z.enum(['browser', 'server']).optional(),
    since: z.number().int().optional().describe('Unix epoch in ms; only entries at or after this time'),
  },
}, ({ limit, level, source, since }) => render(recentLogs(readEntries(logFile), { limit, level, source, since })))

server.registerTool('logs_for_page', {
  description: 'Every log of one page load (browser + server) by pageLoadId - the full correlated tree.',
  inputSchema: { pageLoadId: z.string() },
}, ({ pageLoadId }) => render(logsForPage(readEntries(logFile), pageLoadId)))

server.registerTool('search', {
  description: 'Case-insensitive substring search across log messages.',
  inputSchema: { query: z.string(), limit: LIMIT },
}, ({ query, limit }) => render(search(readEntries(logFile), query, limit ?? 50)))

await server.connect(new StdioServerTransport())
