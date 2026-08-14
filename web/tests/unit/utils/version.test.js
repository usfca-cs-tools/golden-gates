import { describe, it, expect } from 'vitest'
import { parseVersion, atLeast } from '@/utils/version'

describe('parseVersion', () => {
  it('splits "major.minor"', () => {
    expect(parseVersion('1.6')).toEqual([1, 6])
  })

  it('treats missing/garbage as 0', () => {
    expect(parseVersion('')).toEqual([0, 0])
    expect(parseVersion(undefined)).toEqual([0, 0])
    expect(parseVersion('1')).toEqual([1, 0])
  })
})

describe('atLeast', () => {
  it('compares numerically, not lexically', () => {
    // The whole reason this helper exists: '1.10' < '1.6' as strings, but 1.10 >= 1.6 as versions.
    expect(atLeast('1.10', [1, 6])).toBe(true)
    expect(atLeast('1.6', [1, 6])).toBe(true)
    expect(atLeast('1.5', [1, 6])).toBe(false)
    expect(atLeast('2.0', [1, 6])).toBe(true)
    expect(atLeast(undefined, [1, 6])).toBe(false)
  })
})
