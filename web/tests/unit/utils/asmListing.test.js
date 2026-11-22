import { describe, it, expect } from 'vitest'
import { buildListingRows, splitComment } from '@/utils/asmListing'

const TEXT = [
  'main:',                          // 1
  '    li t0, 0x12345678   # big',  // 2  -> 2 words
  '',                               // 3  blank
  '    # comment only',             // 4
  'loop: addi t0, t0, -1',          // 5  label on the same line
  '    bnez t0, loop',              // 6
  'end:'                            // 7  label after the last word
].join('\n')
const SOURCE = { name: 'fib.s', text: TEXT, labels: [['main', 0], ['loop', 2], ['end', 4]] }
const WORDS = [0x123452b7, 0x67828293, 0xfff28293, 0xfe029ee3]
const WORD_LINES = [2, 2, 5, 6]

const rows = () => buildListingRows(SOURCE, WORDS, WORD_LINES)
const summary = r => (r.kind === 'header' || r.kind === 'label' ? `${r.kind} ${r.name}` : `${r.kind} ${r.address}`)

describe('buildListingRows', () => {
  it('lays out header, labels, instructions and continuations in source order', () => {
    expect(rows().map(summary)).toEqual([
      'header fib.s',
      'label main',
      'instruction 0',
      'continuation 1',
      'label loop',
      'instruction 2',
      'instruction 3',
      'label end'
    ])
  })

  it('drops blank and comment-only lines', () => {
    const text = rows().map(r => `${r.code ?? ''}${r.comment ?? ''}`).join('\n')
    expect(text).not.toContain('comment only')
  })

  it('keeps the trailing comment apart from the code', () => {
    expect(rows()[2]).toMatchObject({ code: 'li t0, 0x12345678', comment: '# big', word: WORDS[0], line: 2 })
  })

  it('strips a label that shares the line with its instruction', () => {
    expect(rows()[5]).toMatchObject({ code: 'addi t0, t0, -1', comment: '' })
  })

  it('gives a continuation its word but no source text', () => {
    const cont = rows()[3]
    expect(cont).toMatchObject({ kind: 'continuation', address: 1, word: WORDS[1] })
    expect(cont.code).toBeUndefined()
  })

  it('keeps labels that share an address in source order', () => {
    const source = { ...SOURCE, labels: [['a', 0], ['b', 0]] }
    const labels = buildListingRows(source, WORDS, WORD_LINES).filter(r => r.kind === 'label')
    expect(labels.map(r => r.name)).toEqual(['a', 'b'])
  })

  it('returns no rows without a source', () => {
    expect(buildListingRows(undefined, WORDS, WORD_LINES)).toEqual([])
  })

  it('treats a missing labels list as no labels (1.7-style source)', () => {
    const { labels, ...noLabels } = SOURCE
    expect(buildListingRows(noLabels, WORDS, WORD_LINES).some(r => r.kind === 'label')).toBe(false)
  })
})

describe('splitComment', () => {
  it('splits at the first #', () => {
    expect(splitComment('  addi a0, a0, 1  # inc ')).toEqual({ code: 'addi a0, a0, 1', comment: '# inc' })
  })

  it('returns an empty comment when there is none', () => {
    expect(splitComment('ret')).toEqual({ code: 'ret', comment: '' })
  })

  it('does not split at a # inside a char literal', () => {
    expect(splitComment("li t0, '#'  # hash")).toEqual({ code: "li t0, '#'", comment: '# hash' })
  })

  it('does not end a char literal at an escaped quote', () => {
    expect(splitComment("li t0, '\\''  # quote")).toEqual({ code: "li t0, '\\''", comment: '# quote' })
  })
})
