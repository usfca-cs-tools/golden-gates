import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useCanvasController } from '@/composables/useCanvasController'

// handleKeyDown is wired to BOTH the canvas element's @keydown and a window-level keydown
// listener. When the canvas is focused (which it is right after any click on it), one keypress
// reaches both — so without a guard every shortcut runs twice, most visibly Cmd-Z undoing two
// steps at once. These tests pin the per-event dedupe.
function makeController(undo) {
  return useCanvasController(
    {
      activeCircuit: ref({ components: [], wires: [], wireJunctions: [] }),
      activeTabId: ref('t'),
      allCircuits: ref(new Map([['t', {}]])),
      markCircuitAsModified: vi.fn()
    },
    {
      getMousePos: () => ({ x: 0, y: 0 }),
      snapToGrid: p => p,
      gridSize: ref(15),
      panX: ref(0),
      panY: ref(0),
      isPanning: ref(false)
    },
    {
      startWireDrawing: vi.fn(),
      completeWire: vi.fn(),
      addWireWaypoint: vi.fn(),
      cancelWireDrawing: vi.fn(),
      drawingWire: ref(false),
      startConnection: ref(null)
    },
    {
      clearSelection: vi.fn(),
      selectComponent: vi.fn(),
      deleteSelected: vi.fn(),
      checkAndClearJustFinished: () => false,
      isSelecting: ref(false),
      selectedComponents: ref(new Set()),
      selectedWires: ref(new Set()),
      startSelection: vi.fn(),
      updateSelectionEnd: vi.fn(),
      endSelection: vi.fn()
    },
    {
      isDragging: () => false,
      updateDrag: vi.fn(),
      endDrag: vi.fn(),
      cancelDrag: vi.fn(),
      nudgeSelection: vi.fn(),
      dragging: ref(null)
    },
    { undo, pushSnapshot: vi.fn() }
  )
}

function cmdZ() {
  const ev = new KeyboardEvent('keydown', { key: 'z', metaKey: true })
  ev.preventDefault = () => {}
  return ev
}

describe('useCanvasController key handling', () => {
  it('runs a shortcut once even when the same event reaches both listeners', () => {
    const undo = vi.fn()
    const ctrl = makeController(undo)
    const ev = cmdZ()
    ctrl.handleKeyDown(ev) // canvas element @keydown
    ctrl.handleKeyDown(ev) // window fallback, same event object
    expect(undo).toHaveBeenCalledTimes(1) // NOT twice -> no "undo a step too far"
  })

  it('still handles each distinct keypress (the guard is per-event)', () => {
    const undo = vi.fn()
    const ctrl = makeController(undo)
    ctrl.handleKeyDown(cmdZ())
    ctrl.handleKeyDown(cmdZ())
    expect(undo).toHaveBeenCalledTimes(2)
  })
})
