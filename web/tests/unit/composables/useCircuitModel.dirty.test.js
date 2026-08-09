import { describe, it, expect } from 'vitest'
import { useCircuitModel } from '@/composables/useCircuitModel'

// Dirty tracking underpins the save-on-quit prompt (data integrity): every user edit must set
// hasUnsavedChanges, and a save must clear it. clearCircuit previously bypassed the marker.
describe('useCircuitModel dirty tracking', () => {
  it('clearCircuit marks the circuit modified', () => {
    const cm = useCircuitModel()
    const circuit = cm.createCircuit('c1')
    cm.markCircuitAsSaved(circuit.id)
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(false)

    cm.clearCircuit(circuit.id)
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(true)
  })

  it('renameCircuit marks the circuit modified', () => {
    const cm = useCircuitModel()
    const circuit = cm.createCircuit('c3')
    cm.markCircuitAsSaved(circuit.id)
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(false)

    cm.renameCircuit(circuit.id, 'renamed')
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(true)
  })

  it('markCircuitAsSaved clears the flag and a later edit re-marks it', () => {
    const cm = useCircuitModel()
    const circuit = cm.createCircuit('c2')

    cm.markCircuitAsSaved(circuit.id)
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(false)

    cm.addComponentToCircuit(circuit.id, { id: 'x', type: 'input', props: {} })
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(true)
  })

  it('a transient update (simulation writeback) does not mark the circuit modified', () => {
    const cm = useCircuitModel()
    const circuit = cm.createCircuit('c4')
    cm.addComponentToCircuit(circuit.id, { id: 'out1', type: 'output', props: {} })
    cm.markCircuitAsSaved(circuit.id)

    // Running a circuit writes transient state (output values, step highlights, …) back onto
    // components with { transient: true }; that must NOT dirty the circuit.
    cm.updateComponentInCircuit(
      circuit.id,
      { id: 'out1', type: 'output', props: { value: '42' } },
      { transient: true }
    )
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(false)
    // ...but the component IS still updated — transient skips the dirty/autosave side
    // effects, not the write, so live simulation feedback (output/bus values) is intact.
    const out = cm.getCircuit(circuit.id).components.find(c => c.id === 'out1')
    expect(out.props.value).toBe('42')

    // A genuine edit (no flag) still marks it.
    cm.updateComponentInCircuit(circuit.id, { id: 'out1', type: 'output', props: { value: '99' } })
    expect(cm.getCircuit(circuit.id).hasUnsavedChanges).toBe(true)
  })
})
