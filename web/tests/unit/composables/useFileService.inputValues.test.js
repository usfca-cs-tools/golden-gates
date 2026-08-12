import { describe, it, expect } from 'vitest'
import { useFileService } from '@/composables/useFileService'

const { buildCircuitData, parseAndValidateJSON } = useFileService()

// A canvas input the user has driven to 1, plus the transient lastUpdate bookkeeping.
const clr = () => ({
  id: 'clr',
  type: 'input',
  x: 0,
  y: 0,
  props: { label: 'CLR', bits: 1, value: 1, lastUpdate: 123 }
})

describe('buildCircuitData — input value handling', () => {
  it('strips the transient input value when saving (default)', () => {
    // A saved circuit carries no live stimulus, so value/lastUpdate are dropped.
    const data = buildCircuitData([clr()], [], [])
    const out = data.components.find(c => c.id === 'clr')
    expect(out.props.value).toBeUndefined()
    expect(out.props.lastUpdate).toBeUndefined()
    expect(out.props.label).toBe('CLR') // real config is preserved
  })

  it('keeps the live input value for the run model (keepInputValues)', () => {
    // The run must honor what's on the canvas, or the sim starts every input at the engine
    // default 0 — e.g. a CLR held at 1 would silently run as 0 until toggled.
    const data = buildCircuitData([clr()], [], [], {}, {}, 1, null, { keepInputValues: true })
    const out = data.components.find(c => c.id === 'clr')
    expect(out.props.value).toBe(1)
    expect(out.props.lastUpdate).toBeUndefined() // pure UI bookkeeping still dropped
  })
})

// A Test's pass/fail is a run outcome, not saved state — persisting it made a reopened circuit
// claim its tests passed before they were ever run.
const testComp = () => ({
  id: 't',
  type: 'test',
  x: 0,
  y: 0,
  props: { label: 'AND', status: 'pass', table: { inputNames: [], outputNames: [], rows: [] } }
})

describe('test component status (transient run result)', () => {
  it('is dropped when saving', () => {
    const out = buildCircuitData([testComp()], [], []).components.find(c => c.id === 't')
    expect(out.props.status).toBeUndefined()
    expect(out.props.label).toBe('AND') // real config is preserved
  })

  it('is cleared when loading (handles files saved before this fix)', () => {
    const doc = JSON.stringify({ version: '1.5', components: [testComp()], wires: [] })
    const parsed = parseAndValidateJSON(doc)
    expect(parsed.components.find(c => c.id === 't').props.status).toBeUndefined()
  })
})
