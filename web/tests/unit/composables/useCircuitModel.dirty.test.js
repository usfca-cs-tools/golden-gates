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
})
