import { describe, it, expect } from 'vitest'
import { formatBusValue } from '@/utils/formatBusValue'

describe('formatBusValue', () => {
  it('shows decimal and hex padded to the bus width', () => {
    expect(formatBusValue(42, 6)).toBe('42  ·  0x2A') // ceil(6/4) = 2 hex digits
    expect(formatBusValue(255, 8)).toBe('255  ·  0xFF')
    expect(formatBusValue(10, 8)).toBe('10  ·  0x0A') // padded to 2 nibbles
    expect(formatBusValue(10, 4)).toBe('10  ·  0xA') // 4-bit bus -> single nibble
    expect(formatBusValue(0, 4)).toBe('0  ·  0x0')
  })

  it('shows 64-bit values exactly (string-encoded from the engine, parsed with BigInt)', () => {
    // 2^64 - 1 == 0xFFFFFFFFFFFFFFFF (e.g. -1 in a 64-bit two's-complement register). This is far
    // past JS Number's 2^53 exact range, so it must come through as a string and format exactly.
    expect(formatBusValue('18446744073709551615', 64)).toBe(
      '18446744073709551615  ·  0xFFFFFFFFFFFFFFFF'
    )
    // A large value that would round as a JS Number stays exact.
    expect(formatBusValue('9007199254740993', 64)).toBe(
      '9007199254740993  ·  0x0020000000000001'
    )
  })

  it('returns empty string when there is no value to show', () => {
    expect(formatBusValue(null, 8)).toBe('')
    expect(formatBusValue(undefined, 4)).toBe('')
    expect(formatBusValue('not-a-number', 8)).toBe('')
  })
})
