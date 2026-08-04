import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Wire from '@/components/Wire.vue'

const points = [
  { x: 0, y: 0 },
  { x: 5, y: 0 }
]

describe('Wire bus-value hover (issue #133)', () => {
  it('emits the formatted bus value on hover for a multi-bit wire', async () => {
    const wrapper = mount(Wire, { props: { points, value: 42, bits: 6 } })
    await wrapper.find('g').trigger('mouseenter', { clientX: 100, clientY: 50 })
    const events = wrapper.emitted('valueHover')
    expect(events).toBeTruthy()
    expect(events[0][0]).toEqual({ text: '42  ·  0x2A', x: 100, y: 50 })
  })

  it('does not emit a value for a single-bit wire', async () => {
    const wrapper = mount(Wire, { props: { points, value: 1, bits: 1 } })
    await wrapper.find('g').trigger('mouseenter', { clientX: 100, clientY: 50 })
    expect(wrapper.emitted('valueHover')).toBeFalsy()
  })

  it('does not emit a value when the wire has no value yet', async () => {
    const wrapper = mount(Wire, { props: { points, value: null, bits: 8 } })
    await wrapper.find('g').trigger('mouseenter', { clientX: 100, clientY: 50 })
    expect(wrapper.emitted('valueHover')).toBeFalsy()
  })

  it('emits valueHoverEnd on mouseleave', async () => {
    const wrapper = mount(Wire, { props: { points, value: 42, bits: 6 } })
    await wrapper.find('g').trigger('mouseleave')
    expect(wrapper.emitted('valueHoverEnd')).toBeTruthy()
  })
})
