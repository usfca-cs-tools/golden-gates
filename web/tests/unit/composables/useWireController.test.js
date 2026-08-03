import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useWireController } from '@/composables/useWireController'

// Mock component registry
vi.mock('@/utils/componentRegistry', () => ({
  componentRegistry: {
    'and-gate': {
      connections: {
        inputs: [
          { x: 0, y: 1 },
          { x: 0, y: 2 }
        ],
        outputs: [{ x: 3, y: 1.5 }]
      }
    },
    'or-gate': {
      connections: {
        inputs: [
          { x: 0, y: 1 },
          { x: 0, y: 2 }
        ],
        outputs: [{ x: 3, y: 1.5 }]
      }
    },
    input: {
      connections: {
        inputs: [],
        outputs: [{ x: 2, y: 1 }]
      }
    },
    output: {
      connections: {
        inputs: [{ x: 0, y: 1 }],
        outputs: []
      }
    }
  }
}))

describe('useWireController', () => {
  let wireController
  let mockComponents
  let mockCallbacks
  let mockCircuitManager

  beforeEach(() => {
    mockComponents = ref([
      { id: 'input1', type: 'input', x: 5, y: 5 },
      { id: 'and1', type: 'and-gate', x: 10, y: 5 },
      { id: 'output1', type: 'output', x: 15, y: 5 }
    ])

    mockCallbacks = {
      wires: ref([]),
      wireJunctions: ref([]),
      addWire: vi.fn(),
      removeWire: vi.fn(),
      addWireJunction: vi.fn(),
      removeWireJunction: vi.fn()
    }

    mockCircuitManager = {
      activeCircuit: ref({
        components: mockComponents.value,
        wires: [],
        wireJunctions: []
      })
    }

    wireController = useWireController(
      mockComponents,
      15, // grid size
      mockCallbacks,
      mockCircuitManager
    )
  })

  describe('wire drawing initialization', () => {
    it('should start wire drawing from an output port', () => {
      const mousePos = { x: 105, y: 90 } // 7*15, 6*15 in pixels

      wireController.startWireDrawing('input1', 0, 'output', mousePos)

      expect(wireController.drawingWire.value).toBe(true)
      expect(wireController.wirePoints.value).toHaveLength(1)
      expect(wireController.wirePoints.value[0]).toEqual({ x: 7, y: 6 }) // 5+2, 5+1 in grid units
      expect(wireController.startConnection.value).toEqual({
        portIndex: 0,
        portType: 'output',
        pos: { x: 7, y: 6 }
      })
    })

    it('should start wire drawing from an input port', () => {
      const mousePos = { x: 150, y: 90 } // 10*15, 6*15 in pixels

      wireController.startWireDrawing('and1', 0, 'input', mousePos)

      expect(wireController.drawingWire.value).toBe(true)
      expect(wireController.wirePoints.value).toHaveLength(1)
      expect(wireController.wirePoints.value[0]).toEqual({ x: 10, y: 6 }) // 10+0, 5+1 in grid units
    })

    it('should not start wire drawing from non-existent component', () => {
      wireController.startWireDrawing('nonexistent', 0, 'output', { x: 0, y: 0 })

      expect(wireController.drawingWire.value).toBe(false)
      expect(wireController.wirePoints.value).toHaveLength(0)
    })

    it('should not start wire drawing from invalid port index', () => {
      wireController.startWireDrawing('input1', 5, 'output', { x: 0, y: 0 })

      expect(wireController.drawingWire.value).toBe(false)
      expect(wireController.wirePoints.value).toHaveLength(0)
    })
  })

  describe('wire waypoints', () => {
    beforeEach(() => {
      // Start drawing a wire first
      wireController.startWireDrawing('input1', 0, 'output', { x: 105, y: 90 })
    })

    it('should add horizontal then vertical waypoint', () => {
      const mousePos = { x: 135, y: 120 } // 9*15, 8*15 in pixels

      wireController.addWireWaypoint(mousePos)

      expect(wireController.wirePoints.value).toHaveLength(3)
      expect(wireController.wirePoints.value[1]).toEqual({ x: 9, y: 6 }) // horizontal first
      expect(wireController.wirePoints.value[2]).toEqual({ x: 9, y: 8 }) // then vertical
      expect(wireController.wireDirection.value).toBe('vertical')
    })

    it('should not add waypoint if not drawing', () => {
      wireController.cancelWireDrawing()

      wireController.addWireWaypoint({ x: 135, y: 120 })

      expect(wireController.wirePoints.value).toHaveLength(0)
    })

    it('should handle same position waypoint correctly', () => {
      const mousePos = { x: 105, y: 90 } // Same as starting position

      wireController.addWireWaypoint(mousePos)

      expect(wireController.wirePoints.value).toHaveLength(1) // No new points added
    })
  })

  describe('wire completion', () => {
    beforeEach(() => {
      // Start drawing from input1 output
      wireController.startWireDrawing('input1', 0, 'output', { x: 105, y: 90 })
    })

    it('should complete wire to compatible input port', () => {
      wireController.completeWire('and1', 0, 'input')

      expect(mockCallbacks.addWire).toHaveBeenCalledWith({
        id: expect.stringMatching(/^wire_\d+$/),
        points: [
          { x: 7, y: 6 }, // start point
          { x: 10, y: 6 }, // intermediate orthogonal point
          { x: 10, y: 6 } // end point
        ],
        startConnection: {
          portType: 'output',
          pos: { x: 7, y: 6 }
        },
        endConnection: {
          portType: 'input',
          pos: { x: 10, y: 6 }
        }
      })
      expect(wireController.drawingWire.value).toBe(false)
    })

    it('should not complete wire to incompatible port type', () => {
      wireController.completeWire('input1', 0, 'output')

      expect(mockCallbacks.addWire).not.toHaveBeenCalled()
      expect(wireController.drawingWire.value).toBe(false) // Should cancel
    })

    it('should not complete wire to non-existent component', () => {
      wireController.completeWire('nonexistent', 0, 'input')

      expect(mockCallbacks.addWire).not.toHaveBeenCalled()
      expect(wireController.drawingWire.value).toBe(true) // Should still be drawing
    })

    it('should reverse points when starting from input', () => {
      wireController.cancelWireDrawing()
      wireController.startWireDrawing('and1', 0, 'input', { x: 150, y: 90 })
      wireController.addWireWaypoint({ x: 120, y: 90 })

      wireController.completeWire('input1', 0, 'output')

      const call = mockCallbacks.addWire.mock.calls[0][0]
      expect(call.points[0]).toEqual({ x: 7, y: 6 }) // Should start from output
      expect(call.points[call.points.length - 1]).toEqual({ x: 10, y: 6 }) // End at input
    })
  })

  describe('wire cancellation', () => {
    it('should cancel wire drawing and reset state', () => {
      wireController.startWireDrawing('input1', 0, 'output', { x: 105, y: 90 })
      wireController.addWireWaypoint({ x: 120, y: 90 })

      wireController.cancelWireDrawing()

      expect(wireController.drawingWire.value).toBe(false)
      expect(wireController.wirePoints.value).toHaveLength(0)
      expect(wireController.startConnection.value).toBe(null)
    })
  })

  describe('wire preview', () => {
    beforeEach(() => {
      wireController.startWireDrawing('input1', 0, 'output', { x: 105, y: 90 })
      wireController.currentMousePos.value = { x: 9, y: 8 }
    })

    it('should compute preview points reactively for horizontal-first direction', () => {
      expect(wireController.previewPoints.value).toEqual([
        { x: 7, y: 6 }, // current point
        { x: 9, y: 6 }, // horizontal first
        { x: 9, y: 8 } // then vertical
      ])
    })

    it('should compute preview points for vertical-first direction', () => {
      wireController.wireDirection.value = 'vertical'
      wireController.currentMousePos.value = { x: 9, y: 8 }

      expect(wireController.previewPoints.value).toEqual([
        { x: 7, y: 6 }, // current point
        { x: 7, y: 8 }, // vertical first
        { x: 9, y: 8 } // then horizontal
      ])
    })

    it('should handle same position preview', () => {
      wireController.currentMousePos.value = { x: 7, y: 6 }

      expect(wireController.previewPoints.value).toEqual([
        { x: 7, y: 6 } // Only current point, no preview needed
      ])
    })

    it('should provide empty preview when not drawing', () => {
      wireController.cancelWireDrawing()

      expect(wireController.previewPoints.value).toEqual([])
    })
  })

  describe('junction operations', () => {
    beforeEach(() => {
      // Add a wire to test junctions on
      wireController.wires.value.push({
        id: 'wire1',
        points: [
          { x: 5, y: 5 },
          { x: 10, y: 5 },
          { x: 10, y: 10 }
        ],
        startConnection: { portType: 'output' },
        endConnection: { portType: 'input' }
      })
    })

    it('should find closest grid point on horizontal wire segment', () => {
      const mousePos = { x: 112.5, y: 75 } // 7.5*15, 5*15 in pixels (middle of segment)

      const closest = wireController.findClosestGridPointOnWire(0, mousePos)

      expect(closest).toEqual({ x: 8, y: 5 })
    })

    it('should find closest grid point on vertical wire segment', () => {
      const mousePos = { x: 150, y: 112.5 } // 10*15, 7.5*15 in pixels

      const closest = wireController.findClosestGridPointOnWire(0, mousePos)

      expect(closest).toEqual({ x: 10, y: 8 })
    })

    it('should return null for points too far from wire', () => {
      const mousePos = { x: 300, y: 300 } // Far from any wire

      const closest = wireController.findClosestGridPointOnWire(0, mousePos)

      expect(closest).toBe(null)
    })

    it('should start wire from junction point', () => {
      const junctionPos = { x: 8, y: 5 }

      wireController.startWireFromJunction(0, junctionPos)

      expect(wireController.drawingWire.value).toBe(true)
      expect(wireController.wirePoints.value).toEqual([junctionPos])
      expect(wireController.startConnection.value.isJunction).toBe(true)
      expect(wireController.startConnection.value.sourceWireIndex).toBe(0)
    })

    it('should complete wire at junction and create junction point', () => {
      // Start from input
      wireController.startWireDrawing('and1', 1, 'input', { x: 150, y: 105 })
      const junctionPos = { x: 8, y: 5 }

      wireController.completeWireAtJunction(0, junctionPos)

      expect(mockCallbacks.addWire).toHaveBeenCalled()
      expect(wireController.wireJunctions.value).toContainEqual({
        pos: junctionPos,
        sourceWireIndex: 0,
        connectedWireId: expect.stringMatching(/^wire_\d+$/)
      })
    })

    it('should not connect junction to same source wire', () => {
      wireController.startWireFromJunction(0, { x: 8, y: 5 })

      wireController.completeWireAtJunction(0, { x: 9, y: 5 })

      expect(mockCallbacks.addWire).not.toHaveBeenCalled()
      expect(wireController.drawingWire.value).toBe(false)
    })
  })

  describe('wire deletion and cleanup', () => {
    beforeEach(() => {
      // Setup wires and junctions
      wireController.wires.value = [
        {
          id: 'wire1',
          points: [
            { x: 5, y: 5 },
            { x: 10, y: 5 }
          ]
        },
        {
          id: 'wire2',
          points: [
            { x: 10, y: 5 },
            { x: 15, y: 5 }
          ]
        }
      ]
      wireController.wireJunctions.value = [
        { pos: { x: 8, y: 5 }, sourceWireIndex: 0, connectedWireId: 'wire2' },
        { pos: { x: 12, y: 5 }, sourceWireIndex: 1, connectedWireId: 'wire3' }
      ]
      wireController.selectedWires.value = new Set([0, 1])
    })

    it('should delete selected wires in reverse order', () => {
      wireController.deleteSelectedWires()

      expect(mockCallbacks.removeWire).toHaveBeenCalledTimes(2)
      expect(mockCallbacks.removeWire).toHaveBeenNthCalledWith(1, 1) // Higher index first
      expect(mockCallbacks.removeWire).toHaveBeenNthCalledWith(2, 0)
      expect(wireController.selectedWires.value.size).toBe(0)
    })

    it('should clean up junctions when wires are deleted', () => {
      wireController.cleanupJunctionsForDeletedWires([0, 1], ['wire1', 'wire2'])

      expect(mockCallbacks.removeWireJunction).toHaveBeenCalledTimes(2)
      // Should remove in reverse order to avoid index shifting
      expect(mockCallbacks.removeWireJunction).toHaveBeenNthCalledWith(1, 1)
      expect(mockCallbacks.removeWireJunction).toHaveBeenNthCalledWith(2, 0)
    })

    it('should only clean up junctions connected to deleted wires', () => {
      wireController.cleanupJunctionsForDeletedWires([0], ['wire1'])

      expect(mockCallbacks.removeWireJunction).toHaveBeenCalledTimes(1)
      expect(mockCallbacks.removeWireJunction).toHaveBeenCalledWith(0) // Only first junction
    })
  })


  describe('error handling', () => {
    it('should handle invalid wire index for junction operations', () => {
      const result = wireController.findClosestGridPointOnWire(999, { x: 0, y: 0 })
      expect(result).toBe(null)
    })

    it('should handle empty wire points for junction operations', () => {
      wireController.wires.value = [{ id: 'empty', points: [] }]

      const result = wireController.findClosestGridPointOnWire(0, { x: 0, y: 0 })
      expect(result).toBe(null)
    })

    it('should handle missing component during wire start', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      wireController.startWireDrawing('missing', 0, 'output', { x: 0, y: 0 })

      expect(wireController.drawingWire.value).toBe(false)
      consoleSpy.mockRestore()
    })
  })

  describe('state management', () => {
    it('should maintain correct wire drawing state', () => {
      expect(wireController.drawingWire.value).toBe(false)
      expect(wireController.wirePoints.value).toEqual([])
      expect(wireController.wireDirection.value).toBe('horizontal')
      expect(wireController.startConnection.value).toBe(null)
    })

    it('should track selected wires correctly', () => {
      expect(wireController.selectedWires.value).toBeInstanceOf(Set)
      expect(wireController.selectedWires.value.size).toBe(0)

      wireController.selectedWires.value.add(0)
      expect(wireController.selectedWires.value.has(0)).toBe(true)
    })

    it('should provide reactive preview points', () => {
      expect(wireController.previewPoints.value).toEqual([])

      wireController.startWireDrawing('input1', 0, 'output', { x: 105, y: 90 })
      wireController.currentMousePos.value = { x: 9, y: 8 }

      expect(wireController.previewPoints.value.length).toBeGreaterThan(0)
    })
  })
})
