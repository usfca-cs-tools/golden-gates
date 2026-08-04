import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import AllCircuitsMenu from '@/components/AllCircuitsMenu.vue'

// A minimal stand-in for circuitManager: refs the component reads + the methods it calls.
function makeManager() {
  const circuits = new Map([
    ['c1', { id: 'c1', name: 'alu', hasUnsavedChanges: true, components: [], wires: [] }],
    ['c2', { id: 'c2', name: 'register_file', hasUnsavedChanges: false, components: [], wires: [] }],
    ['c3', { id: 'c3', name: 'control', hasUnsavedChanges: false, components: [], wires: [] }]
  ])
  return {
    allCircuits: ref(circuits),
    openTabs: ref([{ id: 'c1' }]), // only alu is open
    currentProjectDir: ref('/Users/phil/proj/single-cycle-cpu'),
    getCircuit: id => circuits.get(id),
    openTab: vi.fn()
  }
}

const mountMenu = cm =>
  mount(AllCircuitsMenu, {
    props: { circuitManager: cm, activeTabId: 'c1' },
    global: { mocks: { $t: k => k } }
  })

describe('AllCircuitsMenu (issue: reopen closed circuits)', () => {
  it('lists every circuit in the project, marking open and unsaved', async () => {
    const w = mountMenu(makeManager())
    await w.find('.all-btn').trigger('click')

    expect(w.findAll('.row')).toHaveLength(3) // includes the two closed circuits
    expect(w.findAll('.g-open')).toHaveLength(1) // only alu is open
    expect(w.findAll('.g-closed')).toHaveLength(2)
    expect(w.findAll('.rdot')).toHaveLength(1) // only alu is dirty
  })

  it('opens (reopens + focuses) the clicked circuit and closes the menu', async () => {
    const cm = makeManager()
    const w = mountMenu(cm)
    await w.find('.all-btn').trigger('click')

    // rows are sorted by name: alu, control, register_file
    await w.findAll('.row')[1].trigger('click')
    expect(cm.openTab).toHaveBeenCalledWith('c3') // control
    expect(w.find('.menu').exists()).toBe(false)
  })

  it('filters the list', async () => {
    const w = mountMenu(makeManager())
    await w.find('.all-btn').trigger('click')
    await w.find('.menu-search input').setValue('reg')

    expect(w.findAll('.row')).toHaveLength(1)
    expect(w.find('.row-name').text()).toBe('register_file')
  })
})
