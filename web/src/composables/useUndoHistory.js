import { ref, computed } from 'vue'

const MAX_HISTORY = 50

/**
 * Snapshot-based undo history for circuit editing.
 *
 * Usage:
 *   const { pushSnapshot, undo, canUndo } = useUndoHistory(circuitManager)
 *
 * Call pushSnapshot() BEFORE any mutating action.
 * Call undo() to restore the most recent snapshot.
 */
export function useUndoHistory(circuitManager) {
  // Stack of { tabId, components, wires, wireJunctions }
  const history = ref([])

  function takeSnapshot() {
    const circuit = circuitManager.activeCircuit?.value
    if (!circuit) return null
    return {
      tabId: circuitManager.activeTabId?.value,
      components: JSON.parse(JSON.stringify(circuit.components || [])),
      wires: JSON.parse(JSON.stringify(circuit.wires || [])),
      wireJunctions: JSON.parse(JSON.stringify(circuit.wireJunctions || []))
    }
  }

  /** Save a snapshot of the current circuit state onto the history stack. */
  function pushSnapshot() {
    const s = takeSnapshot()
    if (!s) return
    history.value.push(s)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
  }

  /** Restore the most recent snapshot from the history stack. */
  function undo() {
    if (history.value.length === 0) return
    const prev = history.value.pop()

    // Switch to the tab the snapshot was taken on, if different
    if (prev.tabId && prev.tabId !== circuitManager.activeTabId?.value) {
      circuitManager.navigateToCircuit?.(prev.tabId)
    }

    const circuit = circuitManager.activeCircuit?.value
    if (!circuit) return

    circuit.components.splice(0, circuit.components.length, ...prev.components)
    circuit.wires.splice(0, circuit.wires.length, ...prev.wires)
    circuit.wireJunctions.splice(0, circuit.wireJunctions.length, ...prev.wireJunctions)
  }

  /** True when there is at least one snapshot to restore. */
  const canUndo = computed(() => history.value.length > 0)

  return { pushSnapshot, undo, canUndo }
}
