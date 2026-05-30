import { describe, it, expect } from 'vitest'
import { isNoise, toLogLevel, formatArgs, extractStack } from '../src/runtime/utils/normalize'

describe('isNoise', () => {
  it('flags framework noise per source', () => {
    expect(isNoise('[Vue warn]: missing prop', 'browser')).toBe(true)
    expect(isNoise('[vite] hot updated: /app.vue', 'browser')).toBe(true)
    expect(isNoise('Vite server warmed up in 1ms', 'server')).toBe(true)
  })

  it('leaves real app logs untouched', () => {
    expect(isNoise('user clicked save', 'browser')).toBe(false)
    // i18n missing-key warnings are legitimate, not noise
    expect(isNoise('[intlify] Not found \'x\' key', 'browser')).toBe(false)
    expect(isNoise('db query failed', 'server')).toBe(false)
  })
})

describe('toLogLevel', () => {
  it('maps consola/console types to our level set', () => {
    expect(toLogLevel('error')).toBe('error')
    expect(toLogLevel('fatal')).toBe('error')
    expect(toLogLevel('warn')).toBe('warn')
    expect(toLogLevel('info')).toBe('info')
    expect(toLogLevel('success')).toBe('info')
    expect(toLogLevel('debug')).toBe('debug')
    expect(toLogLevel('unknown-type')).toBe('log')
  })
})

describe('formatArgs', () => {
  it('joins args, serialises objects and strips ANSI', () => {
    const esc = String.fromCharCode(27)
    expect(formatArgs(['hello', 'world'])).toBe('hello world')
    expect(formatArgs([`${esc}[31mred${esc}[0m`])).toBe('red')
    expect(formatArgs([{ a: 1 }])).toBe('{"a":1}')
    expect(formatArgs([new Error('boom')])).toBe('boom')
  })
})

describe('extractStack', () => {
  it('returns the stack of the first Error argument, else undefined', () => {
    const err = new Error('x')
    expect(extractStack(['msg', err])).toBe(err.stack)
    expect(extractStack(['no error here'])).toBeUndefined()
  })
})
