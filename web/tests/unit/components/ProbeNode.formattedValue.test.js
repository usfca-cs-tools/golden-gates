import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProbeNode from '@/components/ProbeNode.vue'

// Mirrors OutputNode.bigValue.test.js: formattedValue must parse engine values (sent as
// strings so a 64-bit result survives the JSON round-trip) with BigInt, plus Probe's own
// H/L reading for single-bit signals and its '?' placeholder before any value has arrived.
const formatted = props => mount(ProbeNode, { props: { id: 'p', ...props } }).vm.formattedValue

describe('ProbeNode value display', () => {
  it('shows a question mark before the circuit has ever reported a value', () => {
    expect(formatted({ value: null })).toBe('?')
    expect(formatted({})).toBe('?')
  })

  it('reads a single-bit signal as H/L rather than 1/0', () => {
    expect(formatted({ value: '1', bits: 1 })).toBe('H')
    expect(formatted({ value: '0', bits: 1 })).toBe('L')
    expect(formatted({ value: 0, bits: 1 })).toBe('L')
  })

  it('formats a multi-bit bus like OutputNode, base-aware', () => {
    expect(formatted({ value: 42, base: 16, bits: 8 })).toBe('0x2A')
    expect(formatted({ value: 0, base: 2, bits: 4 })).toBe('0b0000')
    expect(formatted({ value: '18446744073709551615', base: 16, bits: 64 })).toBe(
      '0xFFFFFFFFFFFFFFFF'
    )
  })
})
