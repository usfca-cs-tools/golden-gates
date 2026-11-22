import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

// Echo the key and its fields, so a test can check both without loading en.json.
const t = (key, fields) =>
  fields !== undefined && typeof fields === 'object' ? `${key} ${JSON.stringify(fields)}` : key
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t }) }))

import AsmSourceView from '@/components/AsmSourceView.vue'
import { useViewMode } from '@/composables/useViewMode'

const SOURCE = { name: 'fib_rec_s.s', text: 'li a0, 5\nret\n' }
const asmFile = name => new File(['nop\n'], name)

const mountView = props =>
  mount(AsmSourceView, { props: { sources: [SOURCE], words: [1, 2], ...props }, global: { mocks: { $t: t } } })

const dropZone = wrapper => wrapper.find('.asm-drop-zone')
const drop = (wrapper, files) => dropZone(wrapper).trigger('drop', { dataTransfer: { files } })
const imported = wrapper => (wrapper.emitted('import-file') ?? []).map(([f]) => f.name)
const warnings = wrapper => wrapper.findAll('.asm-warning').map(w => w.text())

describe('AsmSourceView display', () => {
  it('shows the file name and the source verbatim', () => {
    const wrapper = mountView()
    expect(wrapper.find('.asm-file-name').text()).toBe('fib_rec_s.s')
    expect(wrapper.find('.asm-source').text()).toBe(SOURCE.text.trimEnd())
  })

  it('says when there is no program', () => {
    const wrapper = mountView({ sources: [], words: [] })
    expect(wrapper.find('.asm-file-name').text()).toBe('chipsROM.noProgram')
    expect(wrapper.find('.asm-drop-hint').exists()).toBe(true)
    expect(wrapper.find('.asm-source').exists()).toBe(false)
  })

  it('lists errors with a count', () => {
    const wrapper = mountView({ errors: ['a.s:1:1: bad', 'a.s:2:1: worse'] })
    expect(wrapper.findAll('.asm-errors li').map(li => li.text())).toEqual([
      'a.s:1:1: bad',
      'a.s:2:1: worse'
    ])
  })

  it.each([
    ['loading', 'chipsROM.loadingPython'],
    ['assembling', 'chipsROM.assembling']
  ])('shows progress while %s', (status, key) => {
    expect(mountView({ status }).find('.asm-status').text()).toBe(key)
  })

  it('shows no progress when idle', () => {
    expect(mountView().find('.asm-status').exists()).toBe(false)
  })
})

describe('AsmSourceView overflow warning', () => {
  it('appears when addressBits drops below the program and goes when it is raised', async () => {
    const words = [1, 2, 3, 4, 5]
    const wrapper = mountView({ words, addressBits: 3 })
    expect(warnings(wrapper)).toEqual([])
    await wrapper.setProps({ addressBits: 2 })
    expect(warnings(wrapper)).toEqual([
      'chipsROM.overflow {"name":"fib_rec_s.s","words":5,"addressBits":2,"capacity":4}'
    ])
    await wrapper.setProps({ addressBits: 3 })
    expect(warnings(wrapper)).toEqual([])
    expect(words).toEqual([1, 2, 3, 4, 5])
    expect(wrapper.emitted()).not.toHaveProperty('import-file')
  })

  it('does not appear for a program that exactly fills the address space', () => {
    expect(warnings(mountView({ words: [1, 2, 3, 4], addressBits: 2 }))).toEqual([])
  })
})

describe('AsmSourceView picking a file', () => {
  it('emits the picked file and clears the input for re-selection', async () => {
    const wrapper = mountView()
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [asmFile('a.s')] })
    await input.trigger('change')
    expect(imported(wrapper)).toEqual(['a.s'])
    expect(input.element.value).toBe('')
  })

  it.each([
    ['assembling', { status: 'assembling' }],
    ['running', { disabled: true }]
  ])('disables the Import button while %s', (_, props) => {
    expect(mountView(props).find('.asm-import-button').attributes()).toHaveProperty('disabled')
  })
})

describe('AsmSourceView dropping files', () => {
  it('imports a dropped .s file', async () => {
    const wrapper = mountView()
    await drop(wrapper, [asmFile('a.s')])
    expect(imported(wrapper)).toEqual(['a.s'])
  })

  it('matches the extension case-insensitively', async () => {
    const wrapper = mountView()
    await drop(wrapper, [asmFile('A.S')])
    expect(imported(wrapper)).toEqual(['A.S'])
  })

  it('ignores files that are not .s, with a notice', async () => {
    const wrapper = mountView()
    await drop(wrapper, [asmFile('notes.txt')])
    expect(imported(wrapper)).toEqual([])
    expect(warnings(wrapper)).toEqual(['chipsROM.asmFilesOnly'])
  })

  it('imports only the first .s file of several, with a notice', async () => {
    const wrapper = mountView()
    await drop(wrapper, [asmFile('notes.txt'), asmFile('a.s'), asmFile('b.s')])
    expect(imported(wrapper)).toEqual(['a.s'])
    expect(warnings(wrapper)).toEqual(['chipsROM.oneFileOnly {"name":"a.s"}'])
  })

  it('clears the notice on the next import', async () => {
    const wrapper = mountView()
    await drop(wrapper, [asmFile('notes.txt')])
    await drop(wrapper, [asmFile('a.s')])
    expect(warnings(wrapper)).toEqual([])
  })

  it.each([
    ['assembling', { status: 'assembling' }],
    ['running', { disabled: true }]
  ])('ignores a drop while %s', async (_, props) => {
    const wrapper = mountView(props)
    await drop(wrapper, [asmFile('a.s')])
    expect(imported(wrapper)).toEqual([])
  })

  it('highlights on dragover and clears on dragleave and drop', async () => {
    const wrapper = mountView()
    await dropZone(wrapper).trigger('dragover', { dataTransfer: {} })
    expect(dropZone(wrapper).classes()).toContain('drag-over')
    await dropZone(wrapper).trigger('dragleave')
    expect(dropZone(wrapper).classes()).not.toContain('drag-over')
    await dropZone(wrapper).trigger('dragover', { dataTransfer: {} })
    await drop(wrapper, [asmFile('a.s')])
    expect(dropZone(wrapper).classes()).not.toContain('drag-over')
  })

  it('does not highlight while busy, and refuses the drop', async () => {
    const wrapper = mountView({ status: 'assembling' })
    const dataTransfer = {}
    await dropZone(wrapper).trigger('dragover', { dataTransfer })
    expect(dropZone(wrapper).classes()).not.toContain('drag-over')
    expect(dataTransfer.dropEffect).toBe('none')
  })
})

describe('AsmSourceView listing', () => {
  it('renders the listing table when the program has wordLines', () => {
    const wrapper = mountView({ wordLines: [1, 2] })
    expect(wrapper.find('.asm-listing').exists()).toBe(true)
    expect(wrapper.find('pre.asm-source').exists()).toBe(false)
  })
})


describe('AsmSourceView view toggle', () => {
  const { viewMode, setViewMode } = useViewMode()
  const toggle = wrapper => wrapper.find('.asm-view-toggle')
  const button = (wrapper, label) => toggle(wrapper).findAll('button').find(b => b.text() === label)

  beforeEach(() => setViewMode('listing'))
  afterEach(() => vi.unstubAllGlobals())

  it('is hidden until a program is loaded', () => {
    expect(toggle(mountView({ sources: [], words: [] })).exists()).toBe(false)
    expect(toggle(mountView()).exists()).toBe(true)
  })

  it('defaults to Listing and marks it pressed', () => {
    const wrapper = mountView({ wordLines: [1, 2] })
    expect(button(wrapper, 'chipsROM.view.listing').attributes('aria-pressed')).toBe('true')
    expect(button(wrapper, 'chipsROM.view.separate').attributes('aria-pressed')).toBe('false')
  })

  it('Separate shows the source text instead of the listing', async () => {
    const wrapper = mountView({ wordLines: [1, 2] })
    await button(wrapper, 'chipsROM.view.separate').trigger('click')
    expect(wrapper.find('.asm-listing').exists()).toBe(false)
    expect(wrapper.find('pre.asm-source').text()).toBe(SOURCE.text.trimEnd())
  })

  it('saves the choice to localStorage', async () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    const wrapper = mountView({ wordLines: [1, 2] })
    await button(wrapper, 'chipsROM.view.separate').trigger('click')
    expect(setItem).toHaveBeenCalledWith('gg.chipsRomViewMode', 'separate')
  })

  it('still switches when localStorage throws', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('blocked') } })
    const wrapper = mountView({ wordLines: [1, 2] })
    await button(wrapper, 'chipsROM.view.separate').trigger('click')
    expect(viewMode.value).toBe('separate')
    expect(wrapper.find('pre.asm-source').exists()).toBe(true)
  })

  it('asks for a re-import when a program has no wordLines (1.7 file)', () => {
    const wrapper = mountView()
    expect(wrapper.find('.asm-reimport-hint').exists()).toBe(true)
    expect(wrapper.find('pre.asm-source').exists()).toBe(true)
  })

  it('shows no re-import hint in Separate', () => {
    setViewMode('separate')
    expect(mountView().find('.asm-reimport-hint').exists()).toBe(false)
  })
})


