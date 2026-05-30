import { describe, it, expect } from 'vitest'
import { isUuid } from '../src/runtime/utils/correlation'

describe('isUuid', () => {
  it('accepts a real UUID', () => {
    expect(isUuid('80d04154-9e88-446c-a8fe-caaea2914ae8')).toBe(true)
  })

  it('rejects junk, partials and undefined (guards against header injection)', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('80d04154')).toBe(false)
    expect(isUuid('<script>alert(1)</script>')).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})
