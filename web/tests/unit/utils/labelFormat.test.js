import { describe, it, expect } from 'vitest'
import { subscriptParts } from '@/utils/labelFormat'

describe('subscriptParts', () => {
  it('leaves a plain label as a single base segment', () => {
    expect(subscriptParts('PC')).toEqual([{ text: 'PC', subscript: false, drop: false }])
  })

  it('splits a pipeline name at the underscore, tail is a dropped subscript', () => {
    expect(subscriptParts('IW_0')).toEqual([
      { text: 'IW', subscript: false, drop: false },
      { text: '0', subscript: true, drop: true }
    ])
  })

  it('only the first subscript carries the drop; later ones stay at that baseline', () => {
    expect(subscriptParts('A_B_C')).toEqual([
      { text: 'A', subscript: false, drop: false },
      { text: 'B', subscript: true, drop: true },
      { text: 'C', subscript: true, drop: false }
    ])
  })

  it('handles empty/nullish labels without throwing', () => {
    expect(subscriptParts('')).toEqual([{ text: '', subscript: false, drop: false }])
    expect(subscriptParts(null)).toEqual([{ text: '', subscript: false, drop: false }])
    expect(subscriptParts(undefined)).toEqual([{ text: '', subscript: false, drop: false }])
  })

  it('consumes the underscore (it is a marker, not drawn)', () => {
    expect(
      subscriptParts('IW_0')
        .map(p => p.text)
        .join('')
    ).toBe('IW0')
  })
})
