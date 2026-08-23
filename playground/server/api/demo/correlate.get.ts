import { defineEventHandler, getQuery } from 'h3'

/**
 * Correlation probe: logs which client API called it, so the captured entry can
 * be checked for a pageLoadId that differs from its own requestId (which is what
 * proves the browser's page id travelled with the request).
 */
export default defineEventHandler((event) => {
  const via = getQuery(event).via ?? 'unknown'
  console.log(`correlation probe: called via ${via}`)
  return { ok: true, via }
})
