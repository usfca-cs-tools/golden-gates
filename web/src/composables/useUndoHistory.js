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
  // Stack of { tabId, components, wires, wireJunctions }. `history` is the past (undo);
  // `redoStack` is the future you undid your way out of. Both are bounded by MAX_HISTORY:
  // redoStack can never hold more than you've undone.
  const history = ref([])
  const redoStack = ref([])

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
    // A fresh edit forks the timeline: whatever you'd undone can no longer be redone.
    redoStack.value = []
    clearTestStatuses()
  }

  /**
   * Pop `from`, restore it, and push the pre-restore state onto `to` — the shared body of undo
   * (past -> future) and redo (future -> past). Capturing the current state as we go is what
   * makes the two operations invertible.
   */
  function restoreFrom(from, to) {
    if (from.value.length === 0) return
    const target = from.value.pop()

    // A snapshot restores the tab it was captured on. If that circuit no longer exists — its tab
    // was closed, or loading a project replaced every circuit — skip it. Splicing an old (often
    // empty) snapshot into whatever circuit is now active would wipe the current one. This is the
    // guard that stops "open a project, edit, undo -> whole circuit vanishes".
    if (target.tabId && !circuitManager.allCircuits?.value?.has(target.tabId)) return

    // Switch to the tab the snapshot was taken on, if different
    if (target.tabId && target.tabId !== circuitManager.activeTabId?.value) {
      circuitManager.navigateToCircuit?.(target.tabId)
    }

    const circuit = circuitManager.activeCircuit?.value
    // Only restore if we're actually on the snapshot's tab (navigate may have no-op'd).
    if (!circuit || (target.tabId && circuitManager.activeTabId?.value !== target.tabId)) return

    // Save the current (pre-restore) state onto the opposite stack so this move can be reversed.
    const current = takeSnapshot()
    if (current) to.value.push(current)

    circuit.components.splice(0, circuit.components.length, ...target.components)
    circuit.wires.splice(0, circuit.wires.length, ...target.wires)
    circuit.wireJunctions.splice(0, circuit.wireJunctions.length, ...target.wireJunctions)
  }

  /** Restore the most recent snapshot from the history stack. */
  function undo() {
    restoreFrom(history, redoStack)
  }

  /** Re-apply the most recently undone snapshot. */
  function redo() {
    restoreFrom(redoStack, history)
  }

  /** Drop all history — e.g. when loading a project replaces every circuit, so old snapshots
   * reference tabs that no longer exist. */
  function clear() {
    history.value = []
    redoStack.value = []
  }

  /** True when there is at least one snapshot to restore / re-apply. */
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  return { pushSnapshot, undo, redo, clear, canUndo, canRedo }
}
