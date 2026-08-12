import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useCircuitModel } from '@/composables/useCircuitModel'
import { useComponentController } from '@/composables/useComponentController'
import { useUndoHistory } from '@/composables/useUndoHistory'

// canvasOperations surface the controller needs; addComponentAtPosition itself doesn't snap
// (the caller passes grid units), so identity/no-op stubs are enough.
function makeController(cm) {
  return useComponentController(cm, { snapToGrid: p => p, gridSize: ref(15) })
}

describe('addComponentAtPosition (drag-to-place)', () => {
  it('creates a component at the exact grid position given', () => {
    const cm = useCircuitModel()
    const ctrl = makeController(cm)

    const c = ctrl.addComponentAtPosition('and-gate', { x: 12, y: 7 })

    expect(c).toBeTruthy()
    expect(c.type).toBe('and-gate')
    expect(c.x).toBe(12)
    expect(c.y).toBe(7)
    // It was actually added to the active circuit.
    expect(cm.activeCircuit.value.components.some(x => x.id === c.id)).toBe(true)
  })

  it('applies onCreate numbering for inputs (distinct labels/props per instance)', () => {
    const cm = useCircuitModel()
    const ctrl = makeController(cm)

    const a = ctrl.addComponentAtPosition('input', { x: 0, y: 0 })
    const b = ctrl.addComponentAtPosition('input', { x: 0, y: 4 })

    expect(a.id).not.toBe(b.id)
    // onCreate ran (input gets label-ish props); at minimum the two are independent objects.
    expect(a.props).not.toBe(b.props)
  })

  it('passes customProps through (used for subcircuit schematic components)', () => {
    const cm = useCircuitModel()
    const ctrl = makeController(cm)

    const c = ctrl.addComponentAtPosition('schematic-component', { x: 3, y: 3 }, { circuitId: 'circuit_2', label: 'HalfAdder' })

    expect(c.props.circuitId).toBe('circuit_2')
    expect(c.props.label).toBe('HalfAdder')
  })

  it('returns null when there is no active circuit', () => {
    const cm = useCircuitModel()
    const ctrl = makeController(cm)
    cm.activeTabId.value = null // no active circuit

    expect(ctrl.addComponentAtPosition('and-gate', { x: 1, y: 1 })).toBeNull()
  })
})

describe('useUndoHistory.dropLastSnapshot', () => {
  it('discards the most recent snapshot so a cancelled place leaves no phantom undo', () => {
    const cm = useCircuitModel()
    const undo = useUndoHistory(cm)

    expect(undo.canUndo.value).toBe(false)
    undo.pushSnapshot()
    expect(undo.canUndo.value).toBe(true)
    undo.dropLastSnapshot()
    expect(undo.canUndo.value).toBe(false)
  })
})
