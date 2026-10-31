import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ComponentInspector from '@/components/ComponentInspector.vue'
import MemoryDataTable from '@/components/MemoryDataTable.vue'

const chipsROM = (props = {}) => ({
  id: 'c1',
  type: 'chipsROM',
  props: { label: 'IMEM', addressBits: 2, sources: [], words: [0x13, 0x93], ...props }
})

const mountInspector = props =>
  shallowMount(ComponentInspector, { props, global: { mocks: { $t: k => k } } })

const table = wrapper => wrapper.findComponent(MemoryDataTable)

describe('ComponentInspector chipsROM words table', () => {
  it('pads the words to 2^addressBits without touching the prop', () => {
    const component = chipsROM()
    const wrapper = mountInspector({ component })
    expect(table(wrapper).props('modelValue')).toEqual([0x13, 0x93, 0, 0])
    expect(component.props.words).toEqual([0x13, 0x93])
  })

  it('is read-only and 32 bits wide', () => {
    const t = table(mountInspector({ component: chipsROM() }))
    expect(t.props('editable')).toBe(false)
    expect(t.props('dataBits')).toBe(32)
  })

  it('uses 2 columns collapsed and 4 expanded', async () => {
    const wrapper = mountInspector({ component: chipsROM() })
    expect(table(wrapper).props('fixedColumns')).toBe(2)
    await wrapper.setProps({ expanded: true })
    expect(table(wrapper).props('fixedColumns')).toBe(4)
  })

  it('leaves rom unchanged', () => {
    const rom = {
      id: 'r1',
      type: 'rom',
      props: { label: 'ROM', addressBits: 2, dataBits: 8, data: [1, 2, 3, 4] }
    }
    const t = table(mountInspector({ component: rom, expanded: true }))
    expect(t.props('modelValue')).toEqual([1, 2, 3, 4])
    expect(t.props('dataBits')).toBe(8)
    expect(t.props('fixedColumns')).toBe(0)
    expect(t.props('editable')).toBe(true)
  })
})
