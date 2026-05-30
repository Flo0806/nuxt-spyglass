export default defineEventHandler(() => {
  console.log('[stress:late] handler log (inside request)')
  // Fires after the response is sent - probes whether async context survives.
  setTimeout(() => {
    console.log('[stress:late] detached log 60ms after response')
  }, 60)
  return { ok: true }
})
