import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BitRangeTable from '@/components/BitRangeTable.vue'

// The range-endpoint inputs cap at maxBits-1. A splitter drives it with inputBits, a
// merger with outputBits — and only one of the two is set on any given component. These
// pin that the width that is actually set wins, so a 64-bit merger allows bits up to 63
// (regression: a missing inputBits used to inherit an 8-bit default and clamp to 7).
const stubs = {
  InputNumber: {
    props: ['max', 'min', 'modelValue'],
    template: '<input class="num" :data-max="max" />'
  },
  Button: { template: '<button />' }
}

const maxesOf = wrapper =>
  wrapper.findAll('.num').map(n => Number(n.attributes('data-max')))

describe('BitRangeTable endpoint clamp', () => {
  it('merger: outputBits sets the ceiling when inputBits is absent', () => {
    const wrapper = mount(BitRangeTable, {
      props: { modelValue: [{ start: 0, end: 11 }], outputBits: 64 },
      global: { stubs }
    })
    expect(maxesOf(wrapper).every(m => m === 63)).toBe(true)
  })

  it('splitter: inputBits sets the ceiling', () => {
    const wrapper = mount(BitRangeTable, {
      props: { modelValue: [{ start: 0, end: 3 }], inputBits: 16 },
      global: { stubs }
    })
    expect(maxesOf(wrapper).every(m => m === 15)).toBe(true)
  })

  it('falls back to an 8-bit ceiling when neither width is set', () => {
    const wrapper = mount(BitRangeTable, {
      props: { modelValue: [{ start: 0, end: 1 }] },
      global: { stubs }
    })
    expect(maxesOf(wrapper).every(m => m === 7)).toBe(true)
  })
})
