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

  /**
   * A Test's pass/fail badge reflects the last run, so any edit to the circuit
   * makes it stale. pushSnapshot() runs before every mutating action, so reset
   * Test badges to 'pending' here — one chokepoint, no per-editor code — which
   * also prevents a stale green check from being mistaken for a current pass.
   */
  function clearTestStatuses() {
    const circuit = circuitManager.activeCircuit?.value
    if (!circuit?.components) return
    for (const comp of circuit.components) {
      if (comp.type === 'test' && comp.props?.status && comp.props.status !== 'pending') {
        comp.props = { ...comp.props, status: 'pending' }
      }
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
    clearTestStatuses()
  }

  /** Restore the most recent snapshot from the history stack. */
  function undo() {
    if (history.value.length === 0) return
    const prev = history.value.pop()

    // A snapshot restores the tab it was captured on. If that circuit no longer exists — its tab
    // was closed, or loading a project replaced every circuit — skip it. Splicing an old (often
    // empty) snapshot into whatever circuit is now active would wipe the current one. This is the
    // guard that stops "open a project, edit, undo -> whole circuit vanishes".
    if (prev.tabId && !circuitManager.allCircuits?.value?.has(prev.tabId)) return

    // Switch to the tab the snapshot was taken on, if different
    if (prev.tabId && prev.tabId !== circuitManager.activeTabId?.value) {
      circuitManager.navigateToCircuit?.(prev.tabId)
    }

    const circuit = circuitManager.activeCircuit?.value
    // Only restore if we're actually on the snapshot's tab (navigate may have no-op'd).
    if (!circuit || (prev.tabId && circuitManager.activeTabId?.value !== prev.tabId)) return

    circuit.components.splice(0, circuit.components.length, ...prev.components)
    circuit.wires.splice(0, circuit.wires.length, ...prev.wires)
    circuit.wireJunctions.splice(0, circuit.wireJunctions.length, ...prev.wireJunctions)
  }

  /** Drop all history — e.g. when loading a project replaces every circuit, so old snapshots
   * reference tabs that no longer exist. */
  function clear() {
    history.value = []
  }

  /** True when there is at least one snapshot to restore. */
  const canUndo = computed(() => history.value.length > 0)

  return { pushSnapshot, undo, clear, canUndo }
}
