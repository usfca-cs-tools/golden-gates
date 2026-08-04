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

  it('returns empty string when there is no value to show', () => {
    expect(formatBusValue(null, 8)).toBe('')
    expect(formatBusValue(undefined, 4)).toBe('')
  })
})
