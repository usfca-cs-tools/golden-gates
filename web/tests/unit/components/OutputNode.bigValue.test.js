import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OutputNode from '@/components/OutputNode.vue'

// The engine sends Output values as strings so a 64-bit result (e.g. -1 == 0xFFFFFFFFFFFFFFFF in a
// two's-complement register) survives the JSON round-trip exactly. formattedValue must parse with
// BigInt and render the full value, not a rounded JS Number.
const formatted = props => mount(OutputNode, { props: { id: 'o', ...props } }).vm.formattedValue

describe('OutputNode 64-bit value display', () => {
  it('formats a full 64-bit value in hex without rounding', () => {
    expect(formatted({ value: '18446744073709551615', base: 16, bits: 64 })).toBe(
      '0xFFFFFFFFFFFFFFFF'
    )
  })

  it('formats a value past 2^53 in decimal exactly', () => {
    expect(formatted({ value: '9007199254740993', base: 10, bits: 64 })).toBe('9007199254740993')
  })

  it('still formats small numeric values as before', () => {
    expect(formatted({ value: 42, base: 16, bits: 8 })).toBe('0x2A')
    expect(formatted({ value: 0, base: 2, bits: 4 })).toBe('0b0000')
  })
})
