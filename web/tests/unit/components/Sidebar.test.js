import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Sidebar from '@/components/Sidebar.vue'

// Mock vue-i18n so labels resolve to their keys.
const mockT = vi.fn(key => key)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: mockT })
}))

vi.mock('@/components/ComponentIcon.vue', () => ({
  default: {
    name: 'ComponentIcon',
    props: ['componentType', 'size'],
    template: '<div class="component-icon-mock" />'
  }
}))

describe('Sidebar', () => {
  let wrapper

  const createWrapper = (props = {}) =>
    mount(Sidebar, {
      props: { availableComponents: [], projectName: '', activeCircuitId: null, ...props },
      global: { mocks: { $t: mockT }, stubs: { ComponentIcon: true } }
    })

  afterEach(() => wrapper?.unmount())

  it('renders the static category branches plus a custom branch', () => {
    wrapper = createWrapper()
    const headers = wrapper.findAll('.sidebar-branch-header')
    // 7 insertable categories + 1 custom branch
    expect(headers.length).toBe(8)
  })

  it('emits insert with the item action/params on a leaf click', async () => {
    wrapper = createWrapper()
    await wrapper.find('.sidebar-item').trigger('click')

    expect(wrapper.emitted('insert')).toBeTruthy()
    const payload = wrapper.emitted('insert')[0][0]
    expect(payload.action).toBe('addComponent')
    expect(Array.isArray(payload.params)).toBe(true)
  })

  it('emits openCircuit on double-clicking a custom-circuit row', async () => {
    wrapper = createWrapper({
      availableComponents: [{ id: 'circuit_2', name: 'Half Adder' }],
      projectName: 'lab3'
    })

    // The custom branch is the last one; its item is the only addCircuitComponent leaf.
    const rows = wrapper.findAll('.sidebar-item')
    const customRow = rows[rows.length - 1]
    await customRow.trigger('dblclick')

    expect(wrapper.emitted('openCircuit')).toBeTruthy()
    expect(wrapper.emitted('openCircuit')[0][0]).toEqual({ id: 'circuit_2' })
  })

  it('double-clicking a custom row opens it without inserting (click debounced)', async () => {
    vi.useFakeTimers()
    try {
      wrapper = createWrapper({
        availableComponents: [{ id: 'circuit_2', name: 'Half Adder' }],
        projectName: 'lab3'
      })

      // A real double-click delivers two clicks then a dblclick.
      const rows = wrapper.findAll('.sidebar-item')
      const customRow = rows[rows.length - 1]
      await customRow.trigger('click')
      await customRow.trigger('click')
      await customRow.trigger('dblclick')

      // The deferred insert must be cancelled by the dblclick.
      vi.runAllTimers()

      expect(wrapper.emitted('insert')).toBeFalsy()
      expect(wrapper.emitted('openCircuit')[0][0]).toEqual({ id: 'circuit_2' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('single-clicking a custom row inserts it after the debounce window', async () => {
    vi.useFakeTimers()
    try {
      wrapper = createWrapper({
        availableComponents: [{ id: 'circuit_2', name: 'Half Adder' }],
        projectName: 'lab3'
      })

      const rows = wrapper.findAll('.sidebar-item')
      const customRow = rows[rows.length - 1]
      await customRow.trigger('click')
      vi.runAllTimers()

      expect(wrapper.emitted('insert')[0][0].params).toEqual(['circuit_2'])
      expect(wrapper.emitted('openCircuit')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('collapses a branch when its header is clicked', async () => {
    wrapper = createWrapper()
    const before = wrapper.findAll('.sidebar-item').length
    expect(before).toBeGreaterThan(0)

    // Collapse the first branch (logic gates).
    await wrapper.find('.sidebar-branch-header').trigger('click')

    const after = wrapper.findAll('.sidebar-item').length
    expect(after).toBeLessThan(before)
  })

  it('shows an empty-state row for the custom branch when no project circuits exist', () => {
    wrapper = createWrapper()
    expect(wrapper.find('.sidebar-empty').exists()).toBe(true)
  })

  it('a press that moves past the threshold emits placeStart/placeMove then placeEnd', async () => {
    wrapper = createWrapper()
    const row = wrapper.find('.sidebar-item')

    await row.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 0 }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 0 }))

    expect(wrapper.emitted('placeStart')).toBeTruthy()
    const payload = wrapper.emitted('placeStart')[0][0]
    expect(payload.action).toBe('addComponent')
    expect(Array.isArray(payload.params)).toBe(true)

    expect(wrapper.emitted('placeMove')).toBeTruthy()
    expect(wrapper.emitted('placeMove')[0][0]).toEqual({ clientX: 20, clientY: 0 })

    expect(wrapper.emitted('placeEnd')).toBeTruthy()
    expect(wrapper.emitted('placeEnd')[0][0]).toEqual({ clientX: 20, clientY: 0 })
  })

  it('a press below the threshold is a click (insert), not a drag', async () => {
    wrapper = createWrapper()
    const row = wrapper.find('.sidebar-item')

    await row.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 2, clientY: 0 })) // < threshold
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 2, clientY: 0 }))
    // The click that a real tap produces:
    await row.trigger('click')

    expect(wrapper.emitted('placeStart')).toBeFalsy()
    expect(wrapper.emitted('insert')).toBeTruthy()
  })

  it('the click following a drag is suppressed (drag must not also insert)', async () => {
    wrapper = createWrapper()
    const row = wrapper.find('.sidebar-item')

    await row.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 0 }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 30, clientY: 0 }))
    await row.trigger('click') // browsers may still fire a click after the drag

    expect(wrapper.emitted('placeStart')).toBeTruthy()
    expect(wrapper.emitted('insert')).toBeFalsy()
  })
})
