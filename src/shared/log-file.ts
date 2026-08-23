import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Where a Nuxt project keeps its Spyglass log, relative to the project root. */
const LOG_RELATIVE = join('.data', 'spyglass', 'logs.ndjson')

/** How many directory levels below the search root we look for a log file. */
const MAX_DEPTH = 4

/** How far up we walk while looking for a repository root. */
const MAX_ASCEND = 6

/**
 * Directories we never descend into. Dot-directories are skipped wholesale
 * (which also covers `.data` - we probe that path directly instead).
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage'])

export interface LogFileCandidate {
  file: string
  /** Last write time; the freshest candidate is the running dev server. */
  mtimeMs: number
}

export interface ResolvedLogFile {
  /** Absolute path, or null when no log file exists (yet). */
  file: string | null
  /** How we got there - `discovered` means we searched the working directory. */
  source: 'argument' | 'env' | 'discovered' | 'none'
  /** Everything we found, freshest first. More than one means the pick was ambiguous. */
  candidates: LogFileCandidate[]
  /** Directory the search started from. */
  searchRoot: string
}

function collect(dir: string, depth: number, found: LogFileCandidate[]): void {
  const candidate = join(dir, LOG_RELATIVE)
  if (existsSync(candidate)) {
    found.push({ file: candidate, mtimeMs: statSync(candidate).mtimeMs })
  }
  if (depth >= MAX_DEPTH) {
    return
  }
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    // Unreadable directory (permissions, broken symlink): not worth failing over.
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
      continue
    }
    collect(join(dir, entry.name), depth + 1, found)
  }
}

/** Nearest ancestor holding a `.git`, so a search never leaks into a sibling project. */
function repositoryRoot(from: string): string | null {
  let dir = from
  for (let i = 0; i < MAX_ASCEND; i++) {
    if (existsSync(join(dir, '.git'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return null
    }
    dir = parent
  }
  return null
}

function search(root: string): LogFileCandidate[] {
  const found: LogFileCandidate[] = []
  collect(root, 0, found)
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

/**
 * Work out which log file to read.
 *
 * An explicit path always wins, even when the file does not exist yet - the dev
 * server may still be starting. Otherwise we search the working directory, which
 * for an MCP server is the project the AI client was opened in. Monorepos keep
 * their logs a few levels down (`packages/app/.data/...`), hence the recursion;
 * if the working directory itself yields nothing we retry from the repository
 * root, so running from a subdirectory still works without ever crossing into
 * an unrelated project.
 */
export function resolveLogFile(explicit?: string, cwd: string = process.cwd()): ResolvedLogFile {
  if (explicit) {
    return { file: resolve(cwd, explicit), source: 'argument', candidates: [], searchRoot: cwd }
  }

  const fromEnv = process.env.SPYGLASS_LOG_FILE
  if (fromEnv) {
    return { file: resolve(cwd, fromEnv), source: 'env', candidates: [], searchRoot: cwd }
  }

  let searchRoot = cwd
  let candidates = search(searchRoot)

  if (candidates.length === 0) {
    const root = repositoryRoot(cwd)
    if (root && root !== cwd) {
      searchRoot = root
      candidates = search(searchRoot)
    }
  }

  return {
    file: candidates[0]?.file ?? null,
    source: candidates.length > 0 ? 'discovered' : 'none',
    candidates,
    searchRoot,
  }
}

/**
 * Cached resolver for long-running processes. The dev server often starts after
 * the MCP client, so an unresolved lookup must stay cheap to repeat.
 */
export function createLogFileResolver(explicit?: string, ttlMs = 5000): () => ResolvedLogFile {
  let cached: ResolvedLogFile | null = null
  let checkedAt = 0

  return () => {
    const now = Date.now()
    const stale = !cached || now - checkedAt >= ttlMs || (cached.file !== null && !existsSync(cached.file))
    if (stale) {
      cached = resolveLogFile(explicit)
      checkedAt = now
    }
    return cached!
  }
}
