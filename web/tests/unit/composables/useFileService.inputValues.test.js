import { describe, it, expect } from 'vitest'
import { useFileService } from '@/composables/useFileService'

const { buildCircuitData } = useFileService()

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
