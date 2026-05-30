import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { createNdjsonStore } from '../src/runtime/utils/ndjson-store'
import { readEntries } from '../src/mcp/queries'

describe('ndjson store', () => {
  it('rotates to .1 once full and readEntries reads both files, newest preserved', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spyglass-store-'))
    const file = join(dir, 'logs.ndjson')
    const store = createNdjsonStore(file, { maxFileSize: 200 })

    for (let i = 0; i < 12; i++) {
      store.append({ timestamp: i, level: 'info', source: 'server', message: `entry-number-${i}-padding` })
    }

    // append is fire-and-forget through an async write queue; wait for rotation
    await vi.waitFor(() => expect(existsSync(`${file}.1`)).toBe(true), { timeout: 2000 })

    const all = readEntries(file)
    expect(all.length).toBeGreaterThan(0)
    // every surviving line round-trips as valid JSON (no torn writes leaked)
    expect(all.every(e => typeof e.timestamp === 'number')).toBe(true)
    // the most recent entry is never the one dropped by rotation
    expect(all.some(e => e.message.includes('entry-number-11'))).toBe(true)
  })
})
