import { useLogger } from 'evlog'

// evlog folds all per-request logs into ONE "wide event" emitted when the
// response finishes - so these calls show up as attributes on a single line,
// not as three separate log entries. Server API: log.<level>(message, context?).
export default defineEventHandler((event) => {
  const log = useLogger(event)
  log.info('plain info from evlog', { marker: 'EVLOG_INFO' })
  log.set({ user: { id: 'flo' }, step: 'demo' })
  log.warn('a warning from evlog', { marker: 'EVLOG_WARN' })
  log.error('a handled error from evlog', { marker: 'EVLOG_ERROR' })
  return { ok: true }
})
