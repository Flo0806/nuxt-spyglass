import { mkdirSync, mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveLogFile } from '../src/shared/log-file'

let root: string

/** Create `<dir>/.data/spyglass/logs.ndjson`, optionally aged to control the pick. */
function writeLog(dir: string, ageSeconds = 0): string {
  const file = join(dir, '.data', 'spyglass', 'logs.ndjson')
  mkdirSync(join(dir, '.data', 'spyglass'), { recursive: true })
  writeFileSync(file, '{"timestamp":1,"level":"log","source":"server","message":"hi"}\n')
  if (ageSeconds > 0) {
    const when = new Date(Date.now() - ageSeconds * 1000)
    utimesSync(file, when, when)
  }
  return file
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spyglass-resolve-'))
  delete process.env.SPYGLASS_LOG_FILE
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  delete process.env.SPYGLASS_LOG_FILE
})

describe('resolveLogFile', () => {
  it('prefers an explicit path, even for a file that does not exist yet', () => {
    const resolved = resolveLogFile('logs/custom.ndjson', root)
    expect(resolved.source).toBe('argument')
    expect(resolved.file).toBe(join(root, 'logs/custom.ndjson'))
  })

  it('falls back to SPYGLASS_LOG_FILE', () => {
    process.env.SPYGLASS_LOG_FILE = 'from-env.ndjson'
    const resolved = resolveLogFile(undefined, root)
    expect(resolved.source).toBe('env')
    expect(resolved.file).toBe(join(root, 'from-env.ndjson'))
  })

  it('finds the log file in the working directory', () => {
    const file = writeLog(root)
    const resolved = resolveLogFile(undefined, root)
    expect(resolved.source).toBe('discovered')
    expect(resolved.file).toBe(file)
  })

  it('finds a log file nested in a monorepo package', () => {
    const app = join(root, 'packages', 'app')
    mkdirSync(app, { recursive: true })
    const file = writeLog(app)
    expect(resolveLogFile(undefined, root).file).toBe(file)
  })

  it('picks the freshest candidate when several projects have logs', () => {
    writeLog(join(root, 'old'), 600)
    const fresh = writeLog(join(root, 'fresh'))
    const resolved = resolveLogFile(undefined, root)
    expect(resolved.file).toBe(fresh)
    expect(resolved.candidates).toHaveLength(2)
  })

  it('ignores node_modules', () => {
    writeLog(join(root, 'node_modules', 'some-dep'))
    expect(resolveLogFile(undefined, root).file).toBeNull()
  })

  it('does not search deeper than four levels', () => {
    writeLog(join(root, 'a', 'b', 'c', 'd', 'e'))
    expect(resolveLogFile(undefined, root).file).toBeNull()
  })

  it('retries from the repository root when started in a subdirectory', () => {
    mkdirSync(join(root, '.git'), { recursive: true })
    const file = writeLog(join(root, 'packages', 'app'))
    const sub = join(root, 'packages', 'docs')
    mkdirSync(sub, { recursive: true })
    expect(resolveLogFile(undefined, sub).file).toBe(file)
  })

  it('reports nothing found instead of guessing', () => {
    const resolved = resolveLogFile(undefined, root)
    expect(resolved.file).toBeNull()
    expect(resolved.source).toBe('none')
    expect(resolved.searchRoot).toBe(root)
  })
})
