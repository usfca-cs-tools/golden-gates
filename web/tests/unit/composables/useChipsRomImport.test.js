import { describe, it, expect, vi, beforeEach } from 'vitest'

// The composable reads the engine when it is called, so one shared fake drives every case.
// vi.hoisted: vi.mock is hoisted above the imports, so the fake must exist before they run.
const engine = vi.hoisted(() => ({
  isReady: { value: true },
  initialize: null,
  assembleFiles: null
}))

vi.mock('@/composables/usePythonEngine', () => ({ usePythonEngine: () => engine }))

import { useChipsRomImport } from '@/composables/useChipsRomImport'

const SOURCE = 'li a0, 5\nret\n'
const asmFile = (name = 'fib_rec_s.s', text = SOURCE) => ({ name, text: async () => text })
// Echo the key and its fields, so a test can check both without loading en.json.
const t = (key, fields) => (fields ? `${key} ${JSON.stringify(fields)}` : key)

beforeEach(() => {
  engine.isReady.value = true
  engine.initialize = vi.fn(async () => {})
    engine.assembleFiles = vi.fn(async () => ({
    words: [0x00500513, 0x00008067],
    labels: [['main', 0]],
    wordLines: [1, 2]
  }))
})

describe('useChipsRomImport success', () => {
  it('returns the source and its words', async () => {
    const { importFile } = useChipsRomImport()
    expect(await importFile(asmFile(), 6, t)).toEqual({
      ok: true,
      sources: [{ name: 'fib_rec_s.s', text: SOURCE, labels: [['main', 0]] }],
      words: [0x00500513, 0x00008067],
      wordLines: [1, 2]
    })

  })

  it('assembles once, as a one-file list', async () => {
    const { importFile } = useChipsRomImport()
    await importFile(asmFile(), 6, t)
    expect(engine.assembleFiles).toHaveBeenCalledTimes(1)
    expect(engine.assembleFiles).toHaveBeenCalledWith([{ name: 'fib_rec_s.s', text: SOURCE }])
  })

  it('accepts a program that exactly fills the address space', async () => {
    engine.assembleFiles.mockResolvedValue({ words: [1, 2, 3, 4] })
    const { importFile } = useChipsRomImport()
    expect((await importFile(asmFile(), 2, t)).ok).toBe(true)
  })

  it('keeps repeated wordLines for a pseudo-instruction', async () => {
    engine.assembleFiles.mockResolvedValue({
      words: [0x123452b7, 0x67828293],
      labels: [],
      wordLines: [1, 1]
    })
    const { importFile } = useChipsRomImport()
    expect((await importFile(asmFile(), 6, t)).wordLines).toEqual([1, 1])
  })

})

describe('useChipsRomImport rejections', () => {
  it('formats assembler diagnostics compiler-style', async () => {
    engine.assembleFiles.mockResolvedValue({
      diagnostics: [
        { filename: 'fib_rec_s.s', line: 3, column: 5, message: 'unknown instruction' },
        { filename: 'fib_rec_s.s', line: 9, column: 1, message: 'undefined label' }
      ]
    })
    const { importFile } = useChipsRomImport()
    expect(await importFile(asmFile(), 6, t)).toEqual({
      ok: false,
      errors: ['fib_rec_s.s:3:5: unknown instruction', 'fib_rec_s.s:9:1: undefined label']
    })
  })

  it('rejects a file with no instructions', async () => {
    engine.assembleFiles.mockResolvedValue({ words: [] })
    const { importFile } = useChipsRomImport()
    expect(await importFile(asmFile('empty.s', '# nothing\n'), 6, t)).toEqual({
      ok: false,
      errors: ['chipsROM.emptyProgram {"name":"empty.s"}']
    })
  })

  it('rejects a program one word larger than the address space', async () => {
    engine.assembleFiles.mockResolvedValue({ words: [1, 2, 3, 4, 5] })
    const { importFile } = useChipsRomImport()
    expect(await importFile(asmFile(), 2, t)).toEqual({
      ok: false,
      errors: [
        'chipsROM.overflow {"name":"fib_rec_s.s","words":5,"addressBits":2,"capacity":4}'
      ]
    })
  })

  it.each([
    ['reading the file', () => ({ name: 'bad.s', text: async () => Promise.reject(new Error('io')) })],
    ['starting Pyodide', () => ((engine.isReady.value = false), engine.initialize.mockRejectedValue(new Error('net')), asmFile('bad.s'))],
    ['assembling', () => (engine.assembleFiles.mockRejectedValue(new Error('py')), asmFile('bad.s'))]
  ])('resolves, never rejects, when %s throws', async (_, makeFile) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { importFile, status } = useChipsRomImport()
    expect(await importFile(makeFile(), 6, t)).toEqual({
      ok: false,
      errors: ['chipsROM.importFailed {"name":"bad.s"}']
    })
    expect(error).toHaveBeenCalled()
    expect(status.value).toBe('idle')
    error.mockRestore()
  })
})

describe('useChipsRomImport status', () => {
  it('starts Pyodide first when it is not ready', async () => {
    engine.isReady.value = false
    const seen = []
    const { importFile, status } = useChipsRomImport()
    engine.initialize.mockImplementation(async () => seen.push(status.value))
    engine.assembleFiles.mockImplementation(async () => (seen.push(status.value), { words: [1] }))
    await importFile(asmFile(), 6, t)
    expect(seen).toEqual(['loading', 'assembling'])
    expect(status.value).toBe('idle')
  })

  it('skips loading when Pyodide is ready', async () => {
    const { importFile } = useChipsRomImport()
    await importFile(asmFile(), 6, t)
    expect(engine.initialize).not.toHaveBeenCalled()
  })

  it.each([
    ['diagnostics', { diagnostics: [{ filename: 'a.s', line: 1, column: 1, message: 'x' }] }],
    ['an empty program', { words: [] }],
    ['an overflow', { words: Array(65).fill(0) }]
  ])('returns to idle after %s', async (_, result) => {
    engine.assembleFiles.mockResolvedValue(result)
    const { importFile, status } = useChipsRomImport()
    await importFile(asmFile(), 6, t)
    expect(status.value).toBe('idle')
  })
})
