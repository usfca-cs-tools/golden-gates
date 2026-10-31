import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: k => k }) }))

import MemoryDataTable from '@/components/MemoryDataTable.vue'

const WORDS = [0x13, 0x93, 0, 0]

const mountTable = props =>
  mount(MemoryDataTable, {
    props: { modelValue: WORDS, addressBits: 2, dataBits: 32, editable: false, ...props },
    global: {
      mocks: { $t: k => k },
      stubs: { Button: true, BaseSelector: true },
      directives: { tooltip: {} }
    }
  })

const shown = wrapper => wrapper.findAll('input.cell-input').map(c => c.element.value)
const hexFile = () => new File(['v2.0 raw\nff ff ff ff\n'], 'x.hex', { type: 'text/plain' })

describe('MemoryDataTable with editable: false', () => {
  it('ignores a dropped file', async () => {
    const wrapper = mountTable()
    const before = shown(wrapper)
    await wrapper.find('.table-container').trigger('drop', { dataTransfer: { files: [hexFile()] } })
    await new Promise(r => setTimeout(r))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(shown(wrapper)).toEqual(before)
  })

  it('shows no drag overlay', async () => {
    const wrapper = mountTable()
    await wrapper.find('.table-container').trigger('dragenter')
    expect(wrapper.find('.drag-overlay').exists()).toBe(false)
  })

  it('clearData does nothing', async () => {
    const wrapper = mountTable()
    const before = shown(wrapper)
    wrapper.vm.clearData()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(shown(wrapper)).toEqual(before)
  })

  it('an addressBits change emits nothing', async () => {
    const wrapper = mountTable()
    await wrapper.setProps({ addressBits: 1 })
    await wrapper.setProps({ addressBits: 3 })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('mounting with an empty modelValue emits nothing', () => {
    expect(mountTable({ modelValue: [] }).emitted('update:modelValue')).toBeUndefined()
  })
})

describe('MemoryDataTable defaults', () => {
  const firstRowCells = w => w.find('.memory-table tr').findAll('.memory-cell').length

  it('keeps the automatic column count by default', () => {
    expect(firstRowCells(mountTable({ addressBits: 4, modelValue: [] }))).toBe(8)
  })

  it('uses fixedColumns when set', () => {
    expect(firstRowCells(mountTable({ addressBits: 4, modelValue: [], fixedColumns: 2 }))).toBe(2)
  })

  it('still shows the drag overlay when editable', async () => {
    const wrapper = mountTable({ editable: true })
    await wrapper.find('.table-container').trigger('dragenter')
    expect(wrapper.find('.drag-overlay').exists()).toBe(true)
  })
})
