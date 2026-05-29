export default defineEventHandler(() => {
  console.log('server: a plain log from /api/demo/log')
  console.warn('server: a warning', { from: 'demo endpoint' })
  console.error('server: a handled error', new Error('non-fatal server error'))
  return { ok: true }
})
