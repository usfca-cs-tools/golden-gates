import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: k => k }) }))

import MemoryDataTable from '@/components/MemoryDataTable.vue'

// RAM/ROM must be 64-bit clean: cell values above 2**53 must enter, store, display, and reach the
// engine exactly. Cells are stored as exact decimal strings (parseInt/Number would round them).
const mountTable = props =>
  mount(MemoryDataTable, {
    props: { modelValue: [], addressBits: 1, dataBits: 64, editable: true, ...props },
    global: {
      mocks: { $t: k => k },
      stubs: { Button: true, BaseSelector: true },
      directives: { tooltip: {} }
    }
  })

describe('MemoryDataTable 64-bit cells', () => {
  it('stores an entered 64-bit hex cell as an exact decimal string', async () => {
    const wrapper = mountTable()
    const cell = wrapper.find('input.cell-input') // first cell; default base is hex
    await cell.setValue('FFFFFFFFFFFFFFFF') // 2**64 - 1

    const emissions = wrapper.emitted('update:modelValue')
    const last = emissions[emissions.length - 1][0]
    expect(last[0]).toBe('18446744073709551615') // exact, not rounded
  })

  it('clamps an over-width entry to 2^dataBits - 1 exactly', async () => {
    const wrapper = mountTable({ dataBits: 8 })
    const cell = wrapper.find('input.cell-input')
    await cell.setValue('1FF') // 511, over 8 bits

    const emissions = wrapper.emitted('update:modelValue')
    expect(emissions[emissions.length - 1][0][0]).toBe('255') // clamped to 0xFF
  })

  it('displays a stored 64-bit cell value exactly in hex', () => {
    const wrapper = mountTable({ modelValue: ['18446744073709551615', '0'] })
    const firstCell = wrapper.findAll('input.cell-input')[0]
    expect(firstCell.element.value).toBe('FFFFFFFFFFFFFFFF')
  })

  it('imports a hex memory file, clamping each word with BigInt (no Math.min on BigInt)', async () => {
    // Regression: the clamp used Math.min(value, 2^dataBits-1). Once cells became exact and
    // the max became a BigInt, that threw "Cannot convert a BigInt value to a number" on any
    // import. Here 19-bit cells: bare tokens are hex (v2.0 raw) — 7FFFF is the max, 80000 is
    // over (clamps), 1 passes through.
    const wrapper = mountTable({ addressBits: 2, dataBits: 19 })
    const fakeFile = { text: () => Promise.resolve('7FFFF 80000 1') }
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [fakeFile], configurable: true })

    await input.trigger('change')
    await flushPromises()

    const last = wrapper.emitted('update:modelValue').slice(-1)[0][0]
    expect(last[0]).toBe('524287') // 0x7FFFF, exact max
    expect(last[1]).toBe('524287') // 0x80000 clamped to 2^19 - 1
    expect(last[2]).toBe('1')
  })
})
