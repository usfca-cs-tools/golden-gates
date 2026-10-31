import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k, v) => (v ? `${v.name} +${v.count}` : k) })
}))

import ChipsROM from '@/components/ChipsROM.vue'

const mountRom = props =>
  mount(ChipsROM, { props: { id: 'c1', x: 0, y: 0, selected: false, label: 'IMEM', ...props } })

describe('ChipsROM', () => {
  it('has A, sel and D ports', () => {
    const wrapper = mountRom()
    expect(wrapper.findAll('.connection-point.input')).toHaveLength(2)
    expect(wrapper.findAll('.connection-point.output')).toHaveLength(1)
  })

  it('says when there is no program', () => {
    expect(mountRom().text()).toContain('chipsROM.noProgram')
  })

  it('shows the file name', () => {
    const wrapper = mountRom({ sources: [{ name: 'fib.s', text: '' }] })
    expect(wrapper.text()).toContain('fib.s')
  })

  it('shows the first file and a count for several', () => {
    const wrapper = mountRom({
      sources: [
        { name: 'a.s', text: '' },
        { name: 'b.s', text: '' }
      ]
    })
    expect(wrapper.text()).toContain('a.s +1')
  })

  it('truncates a name wider than the body', () => {
    const wrapper = mountRom({ sources: [{ name: 'a_very_long_program_name_here.s', text: '' }] })
    expect(wrapper.text()).toContain('…')
  })
})
