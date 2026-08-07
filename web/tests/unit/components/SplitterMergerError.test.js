import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SplitterComponent from '@/components/SplitterComponent.vue'
import MergerComponent from '@/components/MergerComponent.vue'

// A mis-wired splitter/merger (bit-width mismatch) must read red like every other
// component. Both draw a raw <line> body styled by class, so the error system's
// hasError prop has to reach that line as a `has-error` class.
const cases = [
  { name: 'splitter', comp: SplitterComponent, bodyClass: 'splitter-body', bits: { inputBits: 8 } },
  { name: 'merger', comp: MergerComponent, bodyClass: 'merger-body', bits: { outputBits: 8 } }
]

describe.each(cases)('$name error highlight', ({ comp, bodyClass, bits }) => {
  const mountWith = props =>
    mount(comp, { props: { id: 'x', ranges: [{ start: 0, end: 7 }], ...bits, ...props } })

  it('adds has-error to the body when hasError is set', () => {
    const body = mountWith({ hasError: true }).find(`.${bodyClass}`)
    expect(body.classes()).toContain('has-error')
  })

  it('has no error class in the normal state', () => {
    const body = mountWith({}).find(`.${bodyClass}`)
    expect(body.classes()).not.toContain('has-error')
    expect(body.classes()).not.toContain('has-warning')
  })
})
