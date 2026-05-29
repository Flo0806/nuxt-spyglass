import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LogEntry } from '../types'

export interface NdjsonStoreOptions {
  /** Rotate the active file once it would exceed this many bytes. */
  maxFileSize?: number
}

export interface NdjsonStore {
  /** Queue an entry for append. Fire-and-forget; never throws. */
  append: (entry: LogEntry) => void
}

/**
 * Append-only NDJSON writer with single-step rotation: when the active file is
 * full it becomes `<file>.1` (replacing any previous `.1`) and a fresh active
 * file starts. At most two files exist - recent history, not a long archive.
 * Writes are serialised through a promise chain so lines never interleave.
 */
export function createNdjsonStore(filePath: string, options: NdjsonStoreOptions = {}): NdjsonStore {
  const maxFileSize = options.maxFileSize ?? 5 * 1024 * 1024
  const rotatedPath = `${filePath}.1`

  let queue: Promise<void> = Promise.resolve()
  let dirReady = false
  let size = -1 // unknown until the first write picks up any existing file

  const write = async (entry: LogEntry): Promise<void> => {
    if (!dirReady) {
      await mkdir(dirname(filePath), { recursive: true })
      dirReady = true
    }
    if (size < 0) {
      size = existsSync(filePath) ? (await stat(filePath)).size : 0
    }

    const line = `${JSON.stringify(entry)}\n`
    const bytes = Buffer.byteLength(line)

    // Rotate before writing so the active file never exceeds the cap. A single
    // oversized line (size === 0) is kept rather than rotating an empty file.
    if (size > 0 && size + bytes > maxFileSize) {
      await rm(rotatedPath, { force: true })
      await rename(filePath, rotatedPath)
      size = 0
    }

    await appendFile(filePath, line)
    size += bytes
  }

  return {
    append(entry) {
      // Swallow errors: log persistence must never crash the code it observes.
      queue = queue.then(() => write(entry)).catch(() => {})
    },
  }
}
