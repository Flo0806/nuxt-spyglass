import { describe, it, expect } from 'vitest'
import { scrubString, scrubValue, scrubEntry } from '../src/runtime/utils/scrub'
import type { LogEntry } from '../src/runtime/types'

describe('scrubString', () => {
  it('redacts bearer tokens and JWTs', () => {
    expect(scrubString('Authorization: Bearer abc123.def-456')).not.toContain('abc123')
    expect(scrubString('Authorization: Bearer abc123')).toContain('Bearer [redacted]')
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.sig-Naturepart_42'
    expect(scrubString(`logged ${jwt}`)).not.toContain('eyJzdWIiOiIxMjM0NSJ9')
  })

  it('redacts provider token shapes', () => {
    expect(scrubString(`gh: ghp_${'a'.repeat(36)}`)).not.toContain('aaaa')
    expect(scrubString(`key sk-${'b'.repeat(40)}`)).toContain('[redacted]')
    expect(scrubString('id AKIAIOSFODNN7EXAMPLE here')).toContain('[redacted]')
  })

  it('redacts key=value / key: value / JSON secrets', () => {
    expect(scrubString('password=hunter2')).toBe('password=[redacted]')
    expect(scrubString('api_key: super-secret-value')).toContain('[redacted]')
    expect(scrubString('{"token":"abcd1234"}')).toBe('{"token":"[redacted]"}')
  })

  it('leaves ordinary text untouched', () => {
    expect(scrubString('user clicked the save button')).toBe('user clicked the save button')
  })
})

describe('scrubValue', () => {
  it('redacts sensitive keys by name and secret strings by shape, deeply', () => {
    const out = scrubValue({
      user: 'flo',
      authorization: 'Bearer xyz',
      nested: { password: 'p', note: `sk-${'c'.repeat(30)}` },
      list: ['ok', 'token=leak123'],
    }) as {
      user: string
      authorization: string
      nested: { password: string, note: string }
      list: string[]
    }

    expect(out.user).toBe('flo')
    expect(out.authorization).toBe('[redacted]')
    expect(out.nested.password).toBe('[redacted]')
    expect(out.nested.note).toContain('[redacted]')
    expect(out.list[0]).toBe('ok')
    expect(out.list[1]).toContain('[redacted]')
  })

  it('handles circular references without throwing', () => {
    const a: Record<string, unknown> = { name: 'x' }
    a.self = a
    expect(() => scrubValue(a)).not.toThrow()
  })
})

describe('scrubEntry', () => {
  it('scrubs message, args, stack and route but leaves metadata intact', () => {
    const entry: LogEntry = {
      timestamp: 1,
      level: 'error',
      source: 'server',
      message: 'failed with password=hunter2',
      args: [{ authorization: 'Bearer t' }],
      stack: 'Error: api_key=abc\n    at x',
      route: '/cb?token=leak',
      requestId: 'r1',
      pageLoadId: 'p1',
    }
    const out = scrubEntry(entry)

    expect(out.message).toContain('[redacted]')
    expect((out.args![0] as Record<string, unknown>).authorization).toBe('[redacted]')
    expect(out.stack).toContain('[redacted]')
    expect(out.route).toContain('[redacted]')
    // untouched metadata
    expect(out.timestamp).toBe(1)
    expect(out.requestId).toBe('r1')
    expect(out.level).toBe('error')
  })
})
