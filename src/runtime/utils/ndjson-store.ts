import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { LogEntry } from '../types'

export interface NdjsonStore {
  /** Queue an entry for append. Fire-and-forget; never throws. */
  append: (entry: LogEntry) => void
}

/**
 * Append-only NDJSON writer. Writes are serialised through a promise chain so
 * concurrent log calls can never interleave a half-written line.
 */
export function createNdjsonStore(filePath: string): NdjsonStore {
  let queue: Promise<void> = Promise.resolve()
  let dirReady = false

  const write = async (entry: LogEntry): Promise<void> => {
    if (!dirReady) {
      await mkdir(dirname(filePath), { recursive: true })
      dirReady = true
    }
    await appendFile(filePath, JSON.stringify(entry) + '\n')
  }

  return {
    append(entry) {
      // Swallow errors: log persistence must never crash the code it observes.
      queue = queue.then(() => write(entry)).catch(() => {})
    },
  }
}
