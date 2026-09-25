import { describe, it, expect } from 'vitest'
import { useFileService, stripWireRuntime } from '@/composables/useFileService'

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

// RAM contents are written during simulation (editable: false, unlike ROM's authored data), so
// persisting them made a reopened circuit show a previous run's memory.
const ram = () => ({
  id: 'ram',
  type: 'ram',
  x: 0,
  y: 0,
  props: {
    label: 'RAM',
    addressBits: 4,
    dataBits: 8,
    data: [1, 2, 3, 4],
    lastMemoryUpdate: 456
  }
})

describe('RAM contents (transient run state)', () => {
  it('are stripped when saving; config is preserved', () => {
    const out = buildCircuitData([ram()], [], []).components.find(c => c.id === 'ram')
    expect(out.props.data).toBeUndefined()
    expect(out.props.lastMemoryUpdate).toBeUndefined()
    expect(out.props.addressBits).toBe(4) // real config kept
    expect(out.props.dataBits).toBe(8)
  })

  it('are kept for the run model (keepInputValues), minus the UI timestamp', () => {
    const out = buildCircuitData([ram()], [], [], {}, {}, 1, null, {
      keepInputValues: true
    }).components.find(c => c.id === 'ram')
    expect(out.props.data).toEqual([1, 2, 3, 4])
    expect(out.props.lastMemoryUpdate).toBeUndefined()
  })

  it('are cleared when loading (handles files saved before this fix)', () => {
    const doc = JSON.stringify({ version: '1.5', components: [ram()], wires: [] })
    const parsed = parseAndValidateJSON(doc)
    const out = parsed.components.find(c => c.id === 'ram')
    expect(out.props.data).toBeUndefined()
    expect(out.props.lastMemoryUpdate).toBeUndefined()
    expect(out.props.addressBits).toBe(4) // config survives
  })
})

// A wire carries live run state (value + the highlight animation) that isn't circuit structure;
// persisting it made a reopened circuit show a previous run's edge values.
const wire = () => ({
  id: 'w1',
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 }
  ],
  startConnection: { pos: { x: 0, y: 0 } },
  endConnection: { pos: { x: 4, y: 0 } },
  bits: 8,
  value: '42',
  stepActive: true,
  stepStyle: 'processing'
})

describe('wire run state (value / highlight)', () => {
  it('is stripped when saving; structure is preserved', () => {
    const w = buildCircuitData([], [wire()], []).wires[0]
    expect(w.value).toBeUndefined()
    expect(w.stepActive).toBeUndefined()
    expect(w.stepStyle).toBeUndefined()
    expect(w.id).toBe('w1') // structure kept
    expect(w.points).toHaveLength(2)
    expect(w.bits).toBe(8) // derived width is not run state — left intact
  })

  it('is kept for the run model (keepInputValues), left for the engine to recompute', () => {
    const w = buildCircuitData([], [wire()], [], {}, {}, 1, null, { keepInputValues: true })
      .wires[0]
    expect(w.value).toBe('42')
  })

  it('stripWireRuntime drops exactly value/stepActive/stepStyle (used on load too)', () => {
    const s = stripWireRuntime(wire())
    expect(s).not.toHaveProperty('value')
    expect(s).not.toHaveProperty('stepActive')
    expect(s).not.toHaveProperty('stepStyle')
    expect(s).toMatchObject({ id: 'w1', bits: 8 })
  })
})
