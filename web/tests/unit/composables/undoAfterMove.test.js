import { describe, it, expect } from 'vitest'
import { computed, ref } from 'vue'
import { useCircuitModel } from '@/composables/useCircuitModel'
import { useUndoHistory } from '@/composables/useUndoHistory'
import { useDragController } from '@/composables/useDragController'

// Repro harness for "undo wipes the whole circuit". Mirrors CircuitCanvas wiring: components/wires
// are computed off the active circuit; undo history + drag controller are the real ones.
function harness() {
  const cm = useCircuitModel()
  const circuit = cm.activeCircuit.value
  circuit.components.push({ id: 'c1', type: 'and-gate', x: 2, y: 2, props: { numInputs: 2 } })
  circuit.wires.push({
    id: 'w',
    points: [{ x: 3, y: 1 }, { x: 8, y: 1 }],
    startConnection: { pos: { x: 3, y: 1 } },
    endConnection: { pos: { x: 8, y: 1 } }
  })

  const components = computed(() => cm.activeCircuit.value?.components || [])
  const wires = computed(() => cm.activeCircuit.value?.wires || [])
  const wireJunctions = computed(() => cm.activeCircuit.value?.wireJunctions || [])
  const selectedComponents = ref(new Set())
  const selectedWires = ref(new Set())
  const undo = useUndoHistory(cm)
  const drag = useDragController(
    components,
    wires,
    selectedComponents,
    selectedWires,
    p => p,
    wireJunctions,
    cm
  )
  return { cm, components, selectedComponents, undo, drag }
}

describe('undo repro', () => {
  it('minimal: snapshot -> mutate -> undo keeps the circuit', () => {
    const { cm, undo } = harness()
    undo.pushSnapshot()
    cm.activeCircuit.value.components[0].x = 9
    undo.undo()
    expect(cm.activeCircuit.value.components.length).toBe(1)
    expect(cm.activeCircuit.value.components[0].x).toBe(2)
  })

  it('full drag path: startDrag(snapshot) -> move -> endDrag -> undo keeps the circuit', () => {
    const { cm, selectedComponents, undo, drag } = harness()
    selectedComponents.value.add('c1')
    undo.pushSnapshot() // handleStartDrag does this before startDrag
    drag.startDrag({ id: 'c1', offsetX: 0, offsetY: 0, event: {} })
    drag.updateDrag({ x: 5 * 15, y: 5 * 15 }) // move to (5,5)
    drag.endDrag()
    expect(cm.activeCircuit.value.components[0].x).toBe(5)

    undo.undo()
    expect(cm.activeCircuit.value.components.length).toBe(1) // NOT wiped
    expect(cm.activeCircuit.value.components[0].x).toBe(2) // restored to pre-drag
  })

  // Regression: "open a project, move an output, Cmd-Z wipes the whole circuit." The empty default
  // circuit_1 got snapshotted (clearCircuit during project load), then the load deleted circuit_1;
  // undo must not splice that dead snapshot into the now-active project circuit.
  it('undo skips a snapshot whose tab no longer exists', () => {
    const cm = useCircuitModel() // default empty circuit_1 is active
    const undo = useUndoHistory(cm)

    undo.pushSnapshot() // snapshots the empty circuit_1 (as clearCircuit would during a load)

    // Simulate loadCircuitsFromFiles: replace every circuit with a populated project.
    cm.allCircuits.value.clear()
    const proj = cm.createCircuit('project', { id: 'project', openTab: false })
    proj.components = [{ id: 'o1', type: 'output', x: 1, y: 1, props: {} }]
    cm.openTab('project')

    undo.undo() // pops the dead circuit_1 snapshot
    expect(cm.activeCircuit.value.components.length).toBe(1) // project intact, not wiped
  })

  it('clear() empties the history', () => {
    const cm = useCircuitModel()
    const undo = useUndoHistory(cm)
    undo.pushSnapshot()
    expect(undo.canUndo.value).toBe(true)
    undo.clear()
    expect(undo.canUndo.value).toBe(false)
  })
})
