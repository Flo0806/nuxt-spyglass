import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Where a Spyglass MCP registration was found. `user` means it is active in
 * every project, `project` a committed `.mcp.json`, `local` this directory only.
 */
export type McpScope = 'user' | 'project' | 'local'

interface McpServerEntry {
  command?: string
  args?: string[]
}

interface ClaudeConfig {
  mcpServers?: Record<string, McpServerEntry>
  projects?: Record<string, { mcpServers?: Record<string, McpServerEntry> }>
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  }
  catch {
    // Missing, unreadable or malformed: the caller treats this as "unknown".
    return null
  }
}

function hasSpyglass(servers: Record<string, McpServerEntry> | undefined): boolean {
  return Object.values(servers ?? {}).some((entry) => {
    const launch = [entry.command ?? '', ...(entry.args ?? [])].join(' ')
    return launch.includes('nuxt-spyglass-mcp') || (launch.includes('nuxt-spyglass') && launch.includes('mcp.mjs'))
  })
}

/**
 * Best-effort check whether an AI client already knows about our MCP server, so
 * the dev server can say "connected" instead of repeating setup instructions.
 * Only Claude Code's config layout is understood; anything else reads as unknown
 * and simply falls back to showing the command.
 */
export function detectMcpRegistration(projectRoot: string, home: string = homedir()): McpScope | null {
  const config = readJson<ClaudeConfig>(join(home, '.claude.json'))
  if (config && hasSpyglass(config.mcpServers)) {
    return 'user'
  }

  const projectConfig = readJson<ClaudeConfig>(join(projectRoot, '.mcp.json'))
  if (projectConfig && hasSpyglass(projectConfig.mcpServers)) {
    return 'project'
  }

  if (config && hasSpyglass(config.projects?.[projectRoot]?.mcpServers)) {
    return 'local'
  }

  return null
}
