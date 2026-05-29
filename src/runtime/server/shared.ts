import type { NitroApp } from 'nitropack/types'
import type { NdjsonStore } from '../utils/ndjson-store'

/** Nitro app augmented with the shared log store, set by the server plugin. */
export type SpyglassNitroApp = NitroApp & { spyglassStore?: NdjsonStore }
