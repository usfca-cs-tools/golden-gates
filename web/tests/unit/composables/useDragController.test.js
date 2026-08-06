import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useDragController } from '../../../src/composables/useDragController.js'

// Mock constants
vi.mock('../../../src/utils/constants', () => ({
  GRID_SIZE: 20
}))

// Drive port anchoring from a per-component fixture (`testPorts`); components without it (the
// existing suite) resolve to no ports, exactly as a typeless component would.
vi.mock('../../../src/utils/portGeometry', () => ({
  computeComponentPorts: component => component?.testPorts || []
}))

describe('useDragController - Mixed Selection Drag Fix', () => {
  let components, wires, selectedComponents, selectedWires, wireJunctions, dragController
  let mockSnapToGrid

  beforeEach(() => {
    // Mock components
    components = ref([
      { id: 'comp1', x: 2, y: 2 },
      { id: 'comp2', x: 6, y: 2 }
    ])

    // Mock wires with connection information
    wires = ref([
      {
        id: 'wire1',
        points: [
          { x: 1, y: 1 },
          { x: 3, y: 1 }
        ],
        startConnection: { componentId: 'comp1', pos: { x: 1, y: 1 } },
        endConnection: { componentId: 'comp2', pos: { x: 3, y: 1 } }
      },
      {
        id: 'wire2',
        points: [
          { x: 5, y: 5 },
          { x: 7, y: 5 }
        ],
        startConnection: { componentId: 'comp3', pos: { x: 5, y: 5 } },
        endConnection: { componentId: 'comp4', pos: { x: 7, y: 5 } }
      }
    ])

    selectedComponents = ref(new Set())
    selectedWires = ref(new Set())
    wireJunctions = ref([])

    mockSnapToGrid = vi.fn(pos => pos) // No snapping for tests

    dragController = useDragController(
      components,
      wires,
      selectedComponents,
      selectedWires,
      mockSnapToGrid,
      wireJunctions
    )
  })

  describe('Mixed Selection Drag Consistency', () => {
    it('CRITICAL: should move both components and wires when dragging from component', () => {
      // Set up mixed selection
      selectedComponents.value.add('comp1')
      selectedWires.value.add(0)

      // Start drag from component
      dragController.startDrag({
        id: 'comp1',
        offsetX: 10,
        offsetY: 10,
        event: { metaKey: false, ctrlKey: false }
      })

      // Verify drag state includes both components and wires
      expect(dragController.dragging.value).toBeTruthy()
      expect(dragController.dragging.value.context.components.length).toBe(1)
      expect(dragController.dragging.value.context.wires.length).toBe(1)
      expect(dragController.dragging.value.isWireDrag).toBeFalsy()

      // Update drag position
      dragController.updateDrag({ x: 100, y: 80 }) // Move to (100,80) pixels

      // Calculate expected positions:
      // newX = (100 - 10) / 20 = 4.5 grid units
      // newY = (80 - 10) / 20 = 3.5 grid units
      // Delta from comp1 initial (2,2): (4.5-2, 3.5-2) = (2.5, 1.5)

      // Both component and wire should have moved by same delta
      expect(components.value[0].x).toBeCloseTo(4.5) // comp1: 2 + 2.5 = 4.5
      expect(components.value[0].y).toBeCloseTo(3.5) // comp1: 2 + 1.5 = 3.5
      expect(wires.value[0].points[0].x).toBeCloseTo(3.5) // wire: 1 + 2.5 = 3.5
      expect(wires.value[0].points[0].y).toBeCloseTo(2.5) // wire: 1 + 1.5 = 2.5
    })

    it('CRITICAL: should move both components and wires when dragging from wire', () => {
      // Set up mixed selection
      selectedComponents.value.add('comp1')
      selectedWires.value.add(0)

      // Start drag from wire
      dragController.startWireDrag(0, {
        id: 'wire1',
        offsetX: 10,
        offsetY: 10
      })

      // Verify drag state includes both components and wires
      expect(dragController.dragging.value).toBeTruthy()
      expect(dragController.dragging.value.components.length).toBe(1)
      expect(dragController.dragging.value.wires.length).toBe(1)
      expect(dragController.dragging.value.isWireDrag).toBeTruthy()

      // Update drag position
      dragController.updateDrag({ x: 100, y: 80 }) // Move to (100,80) pixels

      // Calculate expected positions for wire drag:
      // newX = (100 - 10) / 20 = 4.5 grid units
      // newY = (80 - 10) / 20 = 3.5 grid units
      // Delta from wire initial (1,1): (4.5-1, 3.5-1) = (3.5, 2.5)

      // Both component and wire should have moved by same delta
      expect(components.value[0].x).toBeCloseTo(5.5) // comp1: 2 + 3.5 = 5.5
      expect(components.value[0].y).toBeCloseTo(4.5) // comp1: 2 + 2.5 = 4.5
      expect(wires.value[0].points[0].x).toBeCloseTo(4.5) // wire: 1 + 3.5 = 4.5
      expect(wires.value[0].points[0].y).toBeCloseTo(3.5) // wire: 1 + 2.5 = 3.5
    })

    it('moves a junction sitting on a dragged wire (geometry, not stale sourceWireIndex)', () => {
      // Junction taps wire1 mid-span at (2,1). Its stored sourceWireIndex is deliberately wrong
      // (99) — the old code keyed off it and left the junction behind; geometry must catch it.
      wireJunctions.value = [
        { pos: { x: 2, y: 1 }, connectedWireId: 'branch-wire', sourceWireIndex: 99 }
      ]
      selectedWires.value.add(0)

      dragController.startWireDrag(0, { id: 'wire1', offsetX: 10, offsetY: 10 })
      expect(dragController.dragging.value.junctions.length).toBe(1)

      dragController.updateDrag({ x: 100, y: 80 }) // delta (3.5, 2.5)
      expect(wireJunctions.value[0].pos.x).toBeCloseTo(5.5) // 2 + 3.5
      expect(wireJunctions.value[0].pos.y).toBeCloseTo(3.5) // 1 + 2.5
    })

    it('should calculate drag delta correctly when starting from wire', () => {
      selectedComponents.value.add('comp1')
      selectedWires.value.add(0)

      // Record initial positions
      const initialCompX = components.value[0].x
      const initialCompY = components.value[0].y
      const initialWireX = wires.value[0].points[0].x
      const initialWireY = wires.value[0].points[0].y

      // Start drag from wire
      dragController.startWireDrag(0, {
        id: 'wire1',
        offsetX: 20, // Start at wire center (40,20) with offset (20,20)
        offsetY: 20
      })

      // Update to new position
      dragController.updateDrag({ x: 120, y: 100 }) // (120,100) pixels = (6,5) grid units
      // Expected wire position: (120-20)/20 = 5, (100-20)/20 = 4 = (5,4)
      // Delta: (5,4) - (1,1) = (4,3)

      const expectedDeltaX = 4 // (5 - 1)
      const expectedDeltaY = 3 // (4 - 1)

      // Check component moved by same delta
      expect(components.value[0].x).toBeCloseTo(initialCompX + expectedDeltaX)
      expect(components.value[0].y).toBeCloseTo(initialCompY + expectedDeltaY)

      // Check wire moved by same delta
      expect(wires.value[0].points[0].x).toBeCloseTo(initialWireX + expectedDeltaX)
      expect(wires.value[0].points[0].y).toBeCloseTo(initialWireY + expectedDeltaY)
    })

    it('should maintain relative positions when dragging mixed selection', () => {
      // Set up selection with known positions
      selectedComponents.value.add('comp1') // at (2,2)
      selectedComponents.value.add('comp2') // at (6,2)
      selectedWires.value.add(0) // points from (1,1) to (3,1)

      const initialRelativeDistance = components.value[1].x - components.value[0].x // 6 - 2 = 4

      dragController.startWireDrag(0, {
        id: 'wire1',
        offsetX: 0,
        offsetY: 0
      })

      dragController.updateDrag({ x: 80, y: 60 }) // Move wire to (4,3)

      // Components should maintain relative positioning
      const newRelativeDistance = components.value[1].x - components.value[0].x
      expect(newRelativeDistance).toBeCloseTo(initialRelativeDistance)
    })

    it('should only allow wire drag if wire is selected', () => {
      selectedComponents.value.add('comp1')
      // Don't select any wires

      // Try to start drag from unselected wire
      dragController.startWireDrag(0, {
        id: 'wire1',
        offsetX: 10,
        offsetY: 10
      })

      // Drag should not start
      expect(dragController.dragging.value).toBeNull()
    })

    it('should handle grid snapping for mixed selections when dragging from wire', () => {
      selectedComponents.value.add('comp1')
      selectedWires.value.add(0)

      // Mock snapping function
      mockSnapToGrid.mockImplementation(pos => ({
        x: Math.round(pos.x / 20) * 20,
        y: Math.round(pos.y / 20) * 20
      }))

      dragController.startWireDrag(0, {
        id: 'wire1',
        offsetX: 0,
        offsetY: 0
      })

      dragController.updateDrag({ x: 85, y: 75 }) // Unsnapped position
      dragController.endDrag(mockSnapToGrid)

      // Verify snap function was called
      expect(mockSnapToGrid).toHaveBeenCalled()

      // Both component and wire should be snapped to grid
      expect(components.value[0].x % 1).toBe(0) // Should be whole number (grid position)
      expect(components.value[0].y % 1).toBe(0)
      expect(wires.value[0].points[0].x % 1).toBe(0)
      expect(wires.value[0].points[0].y % 1).toBe(0)
    })
  })

  describe('Drag Behavior Consistency Verification', () => {
    it('should include both components and wires regardless of drag start point', () => {
      // The key fix: both startDrag and startWireDrag should include all selected items
      selectedComponents.value.add('comp1')
      selectedWires.value.add(0)

      // Test 1: Drag from component includes both components and wires
      dragController.startDrag({
        id: 'comp1',
        offsetX: 0,
        offsetY: 0,
        event: { metaKey: false, ctrlKey: false }
      })

      expect(dragController.dragging.value.context.components.length).toBe(1)
      expect(dragController.dragging.value.context.wires.length).toBe(1)
      expect(dragController.dragging.value.isWireDrag).toBeFalsy()

      dragController.endDrag(mockSnapToGrid)

      // Test 2: Drag from wire includes both components and wires
      dragController.startWireDrag(0, {
        id: 'wire1',
        offsetX: 0,
        offsetY: 0
      })

      expect(dragController.dragging.value.components.length).toBe(1)
      expect(dragController.dragging.value.wires.length).toBe(1)
      expect(dragController.dragging.value.isWireDrag).toBeTruthy()

      dragController.endDrag(mockSnapToGrid)
    })
  })
})

describe('useDragController - connected drag (wires follow ports)', () => {
  let components, wires, selectedComponents, selectedWires, wireJunctions, dragController, mockSnapToGrid

  const isOrthogonal = pts =>
    pts.slice(0, -1).every((p, i) => p.x === pts[i + 1].x || p.y === pts[i + 1].y)

  beforeEach(() => {
    // A: output port at offset (1,0) -> abs (3,2). B: input port at offset (0,0) -> abs (10,2).
    components = ref([
      { id: 'A', x: 2, y: 2, testPorts: [{ name: '0', x: 1, y: 0, direction: 'output' }] },
      { id: 'B', x: 10, y: 2, testPorts: [{ name: '0', x: 0, y: 0, direction: 'input' }] }
    ])
    // Straight horizontal wire from A's output to B's input.
    wires = ref([
      {
        id: 'w',
        points: [{ x: 3, y: 2 }, { x: 10, y: 2 }],
        startConnection: { pos: { x: 3, y: 2 } },
        endConnection: { pos: { x: 10, y: 2 } }
      }
    ])
    selectedComponents = ref(new Set())
    selectedWires = ref(new Set())
    wireJunctions = ref([])
    mockSnapToGrid = vi.fn(pos => pos) // identity: integer grid coords already

    dragController = useDragController(
      components,
      wires,
      selectedComponents,
      selectedWires,
      mockSnapToGrid,
      wireJunctions,
      null
    )
  })

  it('a boundary wire stretches: moved end follows the port, far end stays', () => {
    selectedComponents.value.add('A')
    dragController.startDrag({ id: 'A', offsetX: 0, offsetY: 0, event: {} })
    dragController.updateDrag({ x: 40, y: 100 }) // A -> (2,5): delta (0,3)
    dragController.endDrag()

    const w = wires.value[0]
    expect(w.points).toEqual([{ x: 3, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 2 }])
    expect(w.points[0]).toEqual({ x: 3, y: 5 }) // start follows A's moved port
    expect(w.points[w.points.length - 1]).toEqual({ x: 10, y: 2 }) // B's port unchanged
    expect(isOrthogonal(w.points)).toBe(true)
    expect(w.startConnection.pos).toEqual({ x: 3, y: 5 })
    expect(w.endConnection.pos).toEqual({ x: 10, y: 2 })
  })

  it('a wire with both ends on moving components translates rigidly', () => {
    selectedComponents.value.add('A')
    selectedComponents.value.add('B')
    dragController.startDrag({ id: 'A', offsetX: 0, offsetY: 0, event: {} })
    dragController.updateDrag({ x: 40, y: 100 }) // delta (0,3) applied to both A and B
    dragController.endDrag()

    expect(wires.value[0].points).toEqual([{ x: 3, y: 5 }, { x: 10, y: 5 }])
  })

  it('Shift axis-lock zeros the minor axis of the drag', () => {
    selectedComponents.value.add('A')
    dragController.startDrag({ id: 'A', offsetX: 0, offsetY: 0, event: {} })
    // Toward (5, 3.2): delta (3, 1.2) -> |x| dominates -> lock to x
    dragController.updateDrag({ x: 100, y: 64 }, { axisLock: true })

    expect(components.value[0].x).toBeCloseTo(5)
    expect(components.value[0].y).toBeCloseTo(2)
  })

  it('nudgeSelection moves the selection and follows the wire', () => {
    selectedComponents.value.add('A')
    const moved = dragController.nudgeSelection({ x: 1, y: 0 })

    expect(moved).toBe(true)
    expect(components.value[0].x).toBe(3)
    expect(wires.value[0].points[0]).toEqual({ x: 4, y: 2 }) // A's port at (2+1)+1 = 4
    expect(wires.value[0].points).toEqual([{ x: 4, y: 2 }, { x: 10, y: 2 }])
  })

  it('cancelDrag restores pre-drag positions and ends the drag', () => {
    selectedComponents.value.add('A')
    dragController.startDrag({ id: 'A', offsetX: 0, offsetY: 0, event: {} })
    dragController.updateDrag({ x: 40, y: 100 }) // move A down
    expect(components.value[0].y).not.toBe(2)

    const cancelled = dragController.cancelDrag()
    expect(cancelled).toBe(true)
    expect(components.value[0]).toMatchObject({ x: 2, y: 2 })
    expect(wires.value[0].points).toEqual([{ x: 3, y: 2 }, { x: 10, y: 2 }])
    expect(dragController.isDragging()).toBe(false)
  })

  it('an unrelated, unselected wire is untouched', () => {
    wires.value.push({
      id: 'other',
      points: [{ x: 20, y: 20 }, { x: 24, y: 20 }],
      startConnection: { pos: { x: 20, y: 20 } },
      endConnection: { pos: { x: 24, y: 20 } }
    })
    selectedComponents.value.add('A')
    dragController.startDrag({ id: 'A', offsetX: 0, offsetY: 0, event: {} })
    dragController.updateDrag({ x: 40, y: 100 })
    dragController.endDrag()

    expect(wires.value[1].points).toEqual([{ x: 20, y: 20 }, { x: 24, y: 20 }])
  })
})
