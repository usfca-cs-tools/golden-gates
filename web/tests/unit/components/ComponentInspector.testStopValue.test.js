import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ComponentInspector from '@/components/ComponentInspector.vue'
import MultibaseNumberInput from '@/components/MultibaseNumberInput.vue'

// A Test's Stop value must hold a full 64-bit value exactly, e.g. 0xFFFFFFFFFFFFFFFF for a
// register that should reach -1 (lab06 sub-imm). The generic number field capped it at 999999
// and a JS Number would round it, so the Stop value uses the 64-bit multibase field instead.
const component = {
  id: 't1',
  type: 'test',
  props: {
    label: 'test-sub-imm',
    table: { inputNames: [], outputNames: [], rows: [] },
    stop_enabled: true,
    stop_output_name: 'T0',
    stop_output_value: 1
  }
}

const mountInspector = () =>
  shallowMount(ComponentInspector, {
    props: { component },
    global: { mocks: { $t: k => k } }
  })

const stopValueField = wrapper =>
  wrapper
    .findAllComponents(MultibaseNumberInput)
    .find(field => field.props('modelValue') === component.props.stop_output_value)

describe('ComponentInspector Test stop value', () => {
  it('edits the stop value with a 64-bit field', () => {
    const field = stopValueField(mountInspector())
    expect(field).toBeTruthy()
    expect(field.props('bits')).toBe(64)
  })

  it('stores 2^64 - 1 exactly, as a decimal string', () => {
    const wrapper = mountInspector()
    stopValueField(wrapper).vm.$emit('update:both', { value: '18446744073709551615', base: 16 })

    const [updated] = wrapper.emitted('update:component').at(-1)
    expect(updated.props.stop_output_value).toBe('18446744073709551615')
  })
})
