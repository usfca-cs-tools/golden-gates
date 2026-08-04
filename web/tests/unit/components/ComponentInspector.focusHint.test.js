import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ComponentInspector from '@/components/ComponentInspector.vue'

// shallowMount stubs the PrimeVue/custom field children; the focus-return hint (issue #132)
// lives in ComponentInspector's own template, so it still renders.
const component = { id: 'c1', type: 'input', props: { label: 'A', bits: 1, value: 0 } }

// The empty-state path uses $t (i18n), which isn't installed in the test env; stub it.
const mountInspector = props =>
  shallowMount(ComponentInspector, { props, global: { mocks: { $t: k => k } } })

describe('ComponentInspector focus-return hint (issue #132)', () => {
  // The test env has no localStorage; provide a simple in-memory one (as the autosave test does).
  beforeEach(() => {
    const store = {}
    global.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v)
      },
      removeItem: k => {
        delete store[k]
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k]
      }
    }
  })

  it('shows the Esc hint when a component is selected', () => {
    const wrapper = mountInspector({ component })
    const hint = wrapper.find('.focus-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('Esc')
  })

  it('hides the hint and remembers the dismissal', async () => {
    const wrapper = mountInspector({ component })
    await wrapper.find('.focus-hint-dismiss').trigger('click')
    expect(wrapper.find('.focus-hint').exists()).toBe(false)
    expect(localStorage.getItem('gg.inspectorFocusHintDismissed')).toBe('1')
  })

  it('stays hidden when previously dismissed', () => {
    localStorage.setItem('gg.inspectorFocusHintDismissed', '1')
    const wrapper = mountInspector({ component })
    expect(wrapper.find('.focus-hint').exists()).toBe(false)
  })

  it('does not show the hint with nothing selected', () => {
    const wrapper = mountInspector({ component: null, circuit: null })
    expect(wrapper.find('.focus-hint').exists()).toBe(false)
  })
})
