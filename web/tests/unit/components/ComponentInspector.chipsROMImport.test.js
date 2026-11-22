import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'

// The inspector's side of import: what it does with importFile's result. The composable itself
// is covered in useChipsRomImport.test.js, so here it is a stub the test resolves by hand.
const importer = vi.hoisted(() => ({ importFile: null }))

vi.mock('@/composables/useChipsRomImport', async () => {
  const { ref } = await import('vue')
  return {
    useChipsRomImport: () => ({ status: ref('idle'), importFile: (...a) => importer.importFile(...a) })
  }
})

import ComponentInspector from '@/components/ComponentInspector.vue'
import AsmSourceView from '@/components/AsmSourceView.vue'
import MemoryDataTable from '@/components/MemoryDataTable.vue'
import { useViewMode } from '@/composables/useViewMode'

const OLD = {
  sources: [{ name: 'old.s', text: 'nop\n', labels: [['old', 0]] }],
  words: [0x13, 0x13, 0x13],
  wordLines: [1, 1, 1]
}

const NEW = {
  sources: [{ name: 'fib_rec_s.s', text: 'li a0, 5\n', labels: [['main', 0]] }],
  words: [0x00500513],
  wordLines: [1]
}

const chipsROM = (id = 'c1', props = {}) => ({
  id,
  type: 'chipsROM',
  props: { label: 'IMEM', addressBits: 6, ...OLD, ...props }
})
const file = { name: 'fib_rec_s.s' }
const $t = k => k

const mountInspector = props =>
  shallowMount(ComponentInspector, { props, global: { mocks: { $t } } })
const view = wrapper => wrapper.findComponent(AsmSourceView)
const drop = async (wrapper, f = file) => {
  view(wrapper).vm.$emit('import-file', f)
  await flushPromises()
}
const updates = wrapper => wrapper.emitted('update:component') ?? []

// Resolve the next importFile call by hand, to change props while it is in flight.
const deferred = () => {
  let resolve
  importer.importFile = vi.fn(() => new Promise(r => (resolve = r)))
  return result => resolve(result)
}

beforeEach(() => {
  importer.importFile = vi.fn(async () => ({ ok: true, ...NEW }))
})

describe('ComponentInspector chipsROM import', () => {
  it('passes the file, current addressBits and $t to importFile', async () => {
    const wrapper = mountInspector({ component: chipsROM('c1', { addressBits: 3 }) })
    await drop(wrapper)
    expect(importer.importFile).toHaveBeenCalledWith(file, 3, $t)
  })

  it('stores sources and words in one update, keeping the other props', async () => {
    const wrapper = mountInspector({ component: chipsROM() })
    await drop(wrapper)
    expect(updates(wrapper)).toHaveLength(1)
    expect(updates(wrapper)[0][0]).toEqual({
      id: 'c1',
      type: 'chipsROM',
      props: { label: 'IMEM', addressBits: 6, ...NEW }
    })
  })

  it('replaces the whole previous program', async () => {
    const wrapper = mountInspector({ component: chipsROM() })
    await drop(wrapper)
    const { props } = updates(wrapper)[0][0]
    expect(props.sources).toEqual(NEW.sources)
    expect(props.words).toEqual(NEW.words)
  })

  it('stores wordLines from the import, replacing the old ones', async () => {
    const wrapper = mountInspector({ component: chipsROM() })
    await drop(wrapper)
    expect(updates(wrapper)[0][0].props.wordLines).toEqual(NEW.wordLines)
  })

  it('passes the stored wordLines to the source view', () => {
    const wrapper = mountInspector({ component: chipsROM() })
    expect(view(wrapper).props('wordLines')).toEqual(OLD.wordLines)
  })

  it('on failure, shows the errors and keeps the previous program', async () => {
    importer.importFile = vi.fn(async () => ({ ok: false, errors: ['a.s:1:1: bad'] }))
    const component = chipsROM()
    const wrapper = mountInspector({ component })
    await drop(wrapper)
    expect(updates(wrapper)).toHaveLength(0)
    expect(view(wrapper).props('errors')).toEqual(['a.s:1:1: bad'])
    expect(component.props).toMatchObject(OLD)
  })

  it('clears old errors when the next import starts', async () => {
    importer.importFile = vi.fn(async () => ({ ok: false, errors: ['a.s:1:1: bad'] }))
    const wrapper = mountInspector({ component: chipsROM() })
    await drop(wrapper)
    const finish = deferred()
    view(wrapper).vm.$emit('import-file', file)
    await flushPromises()
    expect(view(wrapper).props('errors')).toEqual([])
    finish({ ok: true, ...NEW })
    await flushPromises()
    expect(view(wrapper).props('errors')).toEqual([])
  })

  it('clears errors when another component is selected', async () => {
    importer.importFile = vi.fn(async () => ({ ok: false, errors: ['a.s:1:1: bad'] }))
    const wrapper = mountInspector({ component: chipsROM('c1') })
    await drop(wrapper)
    await wrapper.setProps({ component: chipsROM('c2') })
    expect(view(wrapper).props('errors')).toEqual([])
  })

  it('does not show a late failure on a newly selected component', async () => {
    const finish = deferred()
    const wrapper = mountInspector({ component: chipsROM('c1') })
    view(wrapper).vm.$emit('import-file', file)
    await wrapper.setProps({ component: chipsROM('c2') })
    finish({ ok: false, errors: ['a.s:1:1: bad'] })
    await flushPromises()
    expect(view(wrapper).props('errors')).toEqual([])
  })

  it('stores a late success on the component that started the import', async () => {
    const finish = deferred()
    const wrapper = mountInspector({ component: chipsROM('c1') })
    view(wrapper).vm.$emit('import-file', file)
    await wrapper.setProps({ component: chipsROM('c2') })
    finish({ ok: true, ...NEW })
    await flushPromises()
    expect(updates(wrapper)).toHaveLength(1)
    expect(updates(wrapper)[0][0].id).toBe('c1')
  })

  it('lowering addressBits keeps the words', () => {
    const wrapper = mountInspector({ component: chipsROM() })
    wrapper.vm.updateProp('addressBits', 1)
    expect(updates(wrapper)[0][0].props).toMatchObject({ addressBits: 1, words: OLD.words })
  })

  it('disables the source view while running', () => {
    const wrapper = mountInspector({ component: chipsROM(), isRunning: true })
    expect(view(wrapper).props('disabled')).toBe(true)
  })
})

describe('ComponentInspector chipsROM view mode', () => {
  const { setViewMode } = useViewMode()
  const table = wrapper => wrapper.findComponent(MemoryDataTable)

  beforeEach(() => setViewMode('listing'))

  it('hides the words table in Listing', () => {
    expect(table(mountInspector({ component: chipsROM() })).exists()).toBe(false)
  })

  it('shows the words table in Separate', () => {
    setViewMode('separate')
    expect(table(mountInspector({ component: chipsROM() })).exists()).toBe(true)
  })

  it('keeps the words table for a program without wordLines (1.7 file)', () => {
    const wrapper = mountInspector({ component: chipsROM('c1', { wordLines: undefined }) })
    expect(table(wrapper).exists()).toBe(true)
  })
})
