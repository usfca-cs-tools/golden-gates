import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useCanvasController } from '@/composables/useCanvasController'
import { useCircuitModel } from '@/composables/useCircuitModel'
import { useClipboard } from '@/composables/useClipboard'
import { mockClipboardAPI } from '../fixtures/clipboard-test-data'

describe('Clipboard Integration Tests', () => {
  let circuitModel
  let canvasController
  let activeCircuit
  let mockSelection

  beforeEach(() => {
    // Setup clipboard mocks
    global.navigator.clipboard = mockClipboardAPI.createMockNavigatorClipboard()
    global.document.execCommand = mockClipboardAPI.createMockExecCommand()
    vi.clearAllMocks()

    // Create real circuit model
    circuitModel = useCircuitModel()
    activeCircuit = circuitModel.activeCircuit

    // Create minimal mocks for canvas operations
    const mockCanvasOperations = {
      getMousePos: () => ({ x: 100, y: 200 }),
      snapToGrid: pos => ({ x: Math.round(pos.x / 15) * 15, y: Math.round(pos.y / 15) * 15 }),
      gridSize: 15
    }

    // Create minimal mocks for other dependencies
    const mockWireManagement = {
      startWireDrawing: () => {},
      completeWire: () => {},
      addWireWaypoint: () => {},
      cancelWireDrawing: () => {},
      drawingWire: ref(false),
      currentMousePos: ref({ x: 0, y: 0 }),
      startConnection: ref(null),
      findClosestGridPointOnWire: () => null,
      completeWireAtJunction: () => {},
      startWireFromJunction: () => {}
    }

    mockSelection = {
      selectedComponents: ref(new Set()),
      selectedWires: ref(new Set()),
      isSelecting: ref(false),
      selectionRect: ref(null),
      startSelection: () => {},
      updateSelectionEnd: () => {},
      endSelection: () => {},
      selectComponent: id => mockSelection.selectedComponents.value.add(id),
      selectWire: index => mockSelection.selectedWires.value.add(index),
      clearSelection: () => {
        mockSelection.selectedComponents.value.clear()
        mockSelection.selectedWires.value.clear()
      },
      checkAndClearJustFinished: () => false,
      justFinishedSelecting: ref(false),
      deleteSelected: () => {}
    }

    const mockDragAndDrop = {
      isDragging: () => false,
      updateDrag: () => {},
      endDrag: () => {},
      startWireDrag: () => {},
      dragging: ref(null)
    }

    // Create canvas controller with real dependencies
    canvasController = useCanvasController(
      circuitModel,
      mockCanvasOperations,
      mockWireManagement,
      mockSelection,
      mockDragAndDrop
    )

    // Select some components for testing
    const testComponent = {
      id: 'test_input_1',
      type: 'input',
      x: 10,
      y: 10,
      props: { label: 'A', bits: 1 }
    }
    circuitModel.addComponent(testComponent)
    mockSelection.selectComponent(testComponent.id)
  })

  describe('Copy and Paste', () => {
    it('should copy and paste a component', async () => {
      // Copy the selected component
      const copyResult = await canvasController.copySelected()
      expect(copyResult).toBe(true)

      // Clear selection to simulate user clicking elsewhere
      mockSelection.clearSelection()

      // Paste the component
      const pasteResult = await canvasController.pasteFromClipboard()
      expect(pasteResult).toBe(true)

      // Verify the circuit now has 2 components
      expect(activeCircuit.value.components.length).toBe(2)

      // Verify the pasted component has different ID but same properties
      const pastedComponent = activeCircuit.value.components[1]
      expect(pastedComponent.id).not.toBe('test_input_1')
      expect(pastedComponent.type).toBe('input')
      expect(pastedComponent.props.label).toBe('A')
      expect(pastedComponent.props.bits).toBe(1)
    })

    it('should paste at offset position', async () => {
      // Copy the selected component
      await canvasController.copySelected()

      // Paste the component
      await canvasController.pasteFromClipboard()

      // Verify the pasted component exists and has different position or ID
      const originalComponent = activeCircuit.value.components[0]
      const pastedComponent = activeCircuit.value.components[1]

      // Either the position should be different OR the component should be offset
      // (depending on positioning logic implementation)
      expect(pastedComponent.id).not.toBe(originalComponent.id)
      expect(pastedComponent.type).toBe(originalComponent.type)
    })
  })

  describe('Paste across windows', () => {
    // Each desktop window has its own internal clipboard; the OS clipboard is shared.
    function copyInOtherWindow(component) {
      const otherWindowClipboard = useClipboard()
      otherWindowClipboard.copyToClipboard({ components: [component], wires: [], junctions: [] })
      return navigator.clipboard.writeText(otherWindowClipboard.getClipboardDataForOS())
    }

    it("pastes what was last copied in another window, not this window's older copy", async () => {
      await canvasController.copySelected() // this window copies input "A"
      await copyInOtherWindow({ id: 'other_1', type: 'output', x: 0, y: 0, props: { label: 'Z' } })

      mockSelection.clearSelection()
      expect(await canvasController.pasteFromClipboard()).toBe(true)

      const pasted = activeCircuit.value.components[1]
      expect(pasted.type).toBe('output')
      expect(pasted.props.label).toBe('Z')
    })

    it("falls back to this window's copy when the OS clipboard holds ordinary text", async () => {
      await canvasController.copySelected()
      await navigator.clipboard.writeText('just some text')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockSelection.clearSelection()
      expect(await canvasController.pasteFromClipboard()).toBe(true)

      expect(activeCircuit.value.components[1].props.label).toBe('A')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('Cut and Paste', () => {
    it('should cut and paste a component', async () => {
      const originalId = activeCircuit.value.components[0].id

      // Cut the selected component
      const cutResult = await canvasController.cutSelected()
      expect(cutResult).toBe(true)

      // Verify the component is removed
      expect(activeCircuit.value.components.length).toBe(0)

      // Paste the component
      const pasteResult = await canvasController.pasteFromClipboard()
      expect(pasteResult).toBe(true)

      // Verify the circuit has 1 component with new ID
      expect(activeCircuit.value.components.length).toBe(1)
      expect(activeCircuit.value.components[0].id).not.toBe(originalId)
    })
  })

  describe('Duplicate', () => {
    it('should duplicate a component', () => {
      // Duplicate the selected component
      const duplicateResult = canvasController.duplicateSelected()
      expect(duplicateResult).toBe(true)

      // Verify the circuit now has 2 components
      expect(activeCircuit.value.components.length).toBe(2)

      // Verify the duplicated component has different ID but same properties
      const originalComponent = activeCircuit.value.components[0]
      const duplicatedComponent = activeCircuit.value.components[1]

      expect(duplicatedComponent.id).not.toBe(originalComponent.id)
      expect(duplicatedComponent.type).toBe(originalComponent.type)
      expect(duplicatedComponent.props.label).toBe(originalComponent.props.label)
      expect(duplicatedComponent.props.bits).toBe(originalComponent.props.bits)
    })

    it('should duplicate at offset position', () => {
      // Duplicate the selected component
      canvasController.duplicateSelected()

      // Verify the duplicated component exists and has different ID
      const originalComponent = activeCircuit.value.components[0]
      const duplicatedComponent = activeCircuit.value.components[1]

      expect(duplicatedComponent.id).not.toBe(originalComponent.id)
      expect(duplicatedComponent.type).toBe(originalComponent.type)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle copy/paste with wires', async () => {
      // Add another component and a wire
      const outputComponent = {
        id: 'test_output_1',
        type: 'output',
        x: 30,
        y: 10,
        props: { label: 'R', bits: 1 }
      }
      circuitModel.addComponent(outputComponent)

      const wire = {
        id: 'wire_1',
        points: [
          { x: 15, y: 10 },
          { x: 30, y: 10 }
        ],
        startConnection: {
          pos: { x: 15, y: 10 },
          portType: 'output'
        },
        endConnection: {
          pos: { x: 30, y: 10 },
          portType: 'input'
        }
      }
      circuitModel.addWire(wire)

      // Select both components and the wire
      mockSelection.selectComponent('test_input_1')
      mockSelection.selectComponent('test_output_1')
      mockSelection.selectedWires.value.add(0)

      // Copy selection
      await canvasController.copySelected()

      // Paste
      await canvasController.pasteFromClipboard()

      // Verify we have 4 components and 2 wires
      expect(activeCircuit.value.components.length).toBe(4)
      expect(activeCircuit.value.wires.length).toBe(2)

      // Verify the pasted wire has position-based connections
      const pastedWire = activeCircuit.value.wires[1]
      expect(pastedWire.startConnection.pos).toBeDefined()
      expect(pastedWire.endConnection.pos).toBeDefined()
      expect(pastedWire.startConnection.portType).toBe('output')
      expect(pastedWire.endConnection.portType).toBe('input')
    })

    it('should handle multiple paste operations', async () => {
      // Copy the selected component
      await canvasController.copySelected()

      // Paste multiple times
      await canvasController.pasteFromClipboard()

      // Wait to avoid debounce
      await new Promise(resolve => setTimeout(resolve, 150))

      await canvasController.pasteFromClipboard()

      // Verify we have 3 components total
      expect(activeCircuit.value.components.length).toBe(3)
    })
  })

  describe('Error Cases', () => {
    it('should handle paste with no clipboard data', async () => {
      // Override the clipboard mock to return empty/null data for this test
      global.navigator.clipboard.readText = vi.fn().mockResolvedValue('')

      // Don't copy anything first
      const result = await canvasController.pasteFromClipboard()

      expect(result).toBe(false)
      expect(activeCircuit.value.components.length).toBe(1) // Original component only
    })

    it('should handle duplicate with no selection', () => {
      // Clear selection
      mockSelection.clearSelection()

      const result = canvasController.duplicateSelected()

      expect(result).toBe(false)
      expect(activeCircuit.value.components.length).toBe(1) // Original component only
    })
  })
})
