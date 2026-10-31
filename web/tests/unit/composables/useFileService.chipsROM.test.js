import { describe, it, expect } from 'vitest'
import { useFileService } from '@/composables/useFileService'

const { buildCircuitData, parseAndValidateJSON } = useFileService()

const sources = [
  { name: 'sort_s.s', text: 'sort_s:\n    ret\n' },
  { name: 'find_max_index_s.s', text: 'find_max_index_s:\n    ret\n' }
]
const chipsROM = () => ({
  id: 'c1',
  type: 'chipsROM',
  x: 0,
  y: 0,
  props: { label: 'IMEM', addressBits: 6, sources, words: [0x13, 0x8067] }
})

describe('.ggc round-trip for chipsROM', () => {
  const save = () => buildCircuitData([chipsROM()], [], [])

  it('saves no data or listing key', () => {
    const { props } = save().components[0]
    expect(props).not.toHaveProperty('data')
    expect(props).not.toHaveProperty('listing')
  })

  it('keeps sources, words and addressBits through save and load', () => {
    const loaded = parseAndValidateJSON(JSON.stringify(save()))
    const { props } = loaded.components[0]
    expect(props.sources).toEqual(sources)
    expect(props.words).toEqual([0x13, 0x8067])
    expect(props.addressBits).toBe(6)
  })
})
