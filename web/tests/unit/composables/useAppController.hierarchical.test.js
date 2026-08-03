import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Mock the vue-i18n composable
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key, params) => {
      if (params) {
        return `${key} with params: ${JSON.stringify(params)}`
      }
      return key
    }
  })
}))

// Mock the composables with static functions
let mockSaveCircuitFn = vi.fn()
let savedData = null

vi.mock('@/composables/useFileService', () => ({
  useFileService: () => ({
    buildCircuitData: vi.fn(),
    saveCircuit: mockSaveCircuitFn,
    openProject: vi.fn(),
    parseAndValidateJSON: vi.fn()
  })
}))

vi.mock('@/composables/usePythonEngine', () => ({
  usePythonEngine: () => ({
    initialize: vi.fn(),
    runPython: vi.fn(),
    isLoading: ref(false),
    isReady: ref(true),
    error: ref(null),
    pyodide: ref(null),
    executeHierarchicalCircuit: vi.fn()
  })
}))

describe('useAppController - Hierarchical Circuit Saving', () => {
  let mockCircuitManager
  let mockCanvasRef
  let appController
  let originalAlert

  beforeEach(async () => {
    // Mock alert
    originalAlert = global.alert
    global.alert = vi.fn()

    // Reset saved data
    savedData = null

    // Set up the mock save function to capture data
    mockSaveCircuitFn.mockImplementation(
      async (
        components,
        wires,
        wireJunctions,
        circuitMetadata,
        schematicComponents,
        nextCircuitId
      ) => {
        savedData = {
          components,
          wires,
          wireJunctions,
          circuitMetadata,
          schematicComponents,
          nextCircuitId
        }
        return true
      }
    )

    // Create deep component tree structure for testing
    const circuit1 = {
      id: 'circuit_1',
      name: '1-bit Adder',
      label: '1-bit Adder',
      components: [
        { id: 'and1', type: 'and', x: 100, y: 100 },
        { id: 'xor1', type: 'xor', x: 200, y: 100 }
      ],
      wires: [{ id: 'wire1', from: 'and1', to: 'xor1' }],
      properties: { interface: { inputs: ['A', 'B', 'Cin'], outputs: ['Sum', 'Cout'] } }
    }

    const circuit2 = {
      id: 'circuit_2',
      name: '4-bit Adder',
      label: '4-bit Adder',
      components: [
        {
          id: 'adder1',
          type: 'schematic-component',
          props: { circuitId: 'circuit_1' },
          x: 100,
          y: 100
        },
        {
          id: 'adder2',
          type: 'schematic-component',
          props: { circuitId: 'circuit_1' },
          x: 200,
          y: 100
        },
        {
          id: 'adder3',
          type: 'schematic-component',
          props: { circuitId: 'circuit_1' },
          x: 300,
          y: 100
        },
        {
          id: 'adder4',
          type: 'schematic-component',
          props: { circuitId: 'circuit_1' },
          x: 400,
          y: 100
        }
      ],
      wires: [
        { id: 'wire2', from: 'adder1', to: 'adder2' },
        { id: 'wire3', from: 'adder2', to: 'adder3' },
        { id: 'wire4', from: 'adder3', to: 'adder4' }
      ],
      properties: {
        interface: { inputs: ['A[3:0]', 'B[3:0]', 'Cin'], outputs: ['Sum[3:0]', 'Cout'] }
      }
    }

    const circuit3 = {
      id: 'circuit_3',
      name: '8-bit Adder',
      label: '8-bit Adder',
      components: [
        {
          id: 'adder4bit1',
          type: 'schematic-component',
          props: { circuitId: 'circuit_2' },
          x: 100,
          y: 100
        },
        {
          id: 'adder4bit2',
          type: 'schematic-component',
          props: { circuitId: 'circuit_2' },
          x: 300,
          y: 100
        }
      ],
      wires: [{ id: 'wire5', from: 'adder4bit1', to: 'adder4bit2' }],
      properties: {
        interface: { inputs: ['A[7:0]', 'B[7:0]', 'Cin'], outputs: ['Sum[7:0]', 'Cout'] }
      }
    }

    // Unused circuits that should still be saved
    const unusedCircuit1 = {
      id: 'circuit_unused_1',
      name: 'Unused Multiplier',
      label: 'Unused Multiplier',
      components: [
        { id: 'mult1', type: 'and', x: 100, y: 100 },
        { id: 'mult2', type: 'or', x: 200, y: 100 }
      ],
      wires: [{ id: 'wire_unused1', from: 'mult1', to: 'mult2' }],
      properties: { interface: { inputs: ['A', 'B'], outputs: ['Product'] } }
    }

    const unusedCircuit2 = {
      id: 'circuit_unused_2',
      name: 'Unused Comparator',
      label: 'Unused Comparator',
      components: [
        { id: 'comp1', type: 'xor', x: 100, y: 100 },
        { id: 'comp2', type: 'not', x: 200, y: 100 }
      ],
      wires: [{ id: 'wire_unused2', from: 'comp1', to: 'comp2' }],
      properties: { interface: { inputs: ['A', 'B'], outputs: ['Equal'] } }
    }

    // Component definitions for schematic components
    const componentDef1 = {
      type: 'circuit-component',
      name: '1-bit Adder',
      label: '1-bit Adder',
      inputs: ['A', 'B', 'Cin'],
      outputs: ['Sum', 'Cout'],
      width: 60,
      height: 40
    }

    const componentDef2 = {
      type: 'circuit-component',
      name: '4-bit Adder',
      label: '4-bit Adder',
      inputs: ['A[3:0]', 'B[3:0]', 'Cin'],
      outputs: ['Sum[3:0]', 'Cout'],
      width: 80,
      height: 60
    }

    const componentDef3 = {
      type: 'circuit-component',
      name: '8-bit Adder',
      label: '8-bit Adder',
      inputs: ['A[7:0]', 'B[7:0]', 'Cin'],
      outputs: ['Sum[7:0]', 'Cout'],
      width: 100,
      height: 80
    }

    const unusedComponentDef1 = {
      type: 'circuit-component',
      name: 'Unused Multiplier',
      label: 'Unused Multiplier',
      inputs: ['A', 'B'],
      outputs: ['Product'],
      width: 60,
      height: 40
    }

    const unusedComponentDef2 = {
      type: 'circuit-component',
      name: 'Unused Comparator',
      label: 'Unused Comparator',
      inputs: ['A', 'B'],
      outputs: ['Equal'],
      width: 60,
      height: 40
    }

    // Mock circuit manager
    mockCircuitManager = {
      allCircuits: ref(
        new Map([
          ['circuit_1', circuit1],
          ['circuit_2', circuit2],
          ['circuit_3', circuit3],
          ['circuit_unused_1', unusedCircuit1],
          ['circuit_unused_2', unusedCircuit2]
        ])
      ),
      availableComponents: ref(
        new Map([
          ['circuit_1', componentDef1],
          ['circuit_2', componentDef2],
          ['circuit_3', componentDef3],
          ['circuit_unused_1', unusedComponentDef1],
          ['circuit_unused_2', unusedComponentDef2]
        ])
      ),
      activeTabId: ref('circuit_3'),
      activeCircuit: ref(circuit3),
      currentProjectDir: ref(null),
      openTabs: ref([{ id: 'circuit_1' }, { id: 'circuit_2' }, { id: 'circuit_3' }]),
      getCircuit: vi.fn(id => {
        const circuits = new Map([
          ['circuit_1', circuit1],
          ['circuit_2', circuit2],
          ['circuit_3', circuit3],
          ['circuit_unused_1', unusedCircuit1],
          ['circuit_unused_2', unusedCircuit2]
        ])
        return circuits.get(id)
      }),
      exportState: vi.fn(() => ({
        nextCircuitId: 6,
        allCircuits: {
          circuit_1: circuit1,
          circuit_2: circuit2,
          circuit_3: circuit3,
          circuit_unused_1: unusedCircuit1,
          circuit_unused_2: unusedCircuit2
        },
        availableComponents: {
          circuit_1: componentDef1,
          circuit_2: componentDef2,
          circuit_3: componentDef3,
          circuit_unused_1: unusedComponentDef1,
          circuit_unused_2: unusedComponentDef2
        },
        activeTabId: 'circuit_3',
        openTabs: [{ id: 'circuit_1' }, { id: 'circuit_2' }, { id: 'circuit_3' }]
      })),
      markCircuitAsSaved: vi.fn(),
      projectCircuitFiles: ref([])
    }

    // Mock canvas reference
    mockCanvasRef = {
      components: circuit3.components,
      wires: circuit3.wires,
      wireJunctions: []
    }

    // Import and create the controller
    const { useAppController } = await import('@/composables/useAppController')
    appController = useAppController(mockCircuitManager)
  })

  afterEach(() => {
    global.alert = originalAlert
    vi.clearAllMocks()
  })

  describe('deep component tree saving', () => {
    it('should save all levels of hierarchical components', async () => {
      await appController.saveCircuit(mockCanvasRef)

      expect(mockSaveCircuitFn).toHaveBeenCalled()
      expect(savedData).not.toBeNull()

      // Verify all schematic components are saved, including deep dependencies
      expect(savedData.schematicComponents).toHaveProperty('circuit_1')
      expect(savedData.schematicComponents).toHaveProperty('circuit_2')
      expect(savedData.schematicComponents).toHaveProperty('circuit_3')

      // Verify the hierarchy is preserved
      const circuit1Data = savedData.schematicComponents['circuit_1']
      expect(circuit1Data.definition.name).toBe('1-bit Adder')
      expect(circuit1Data.circuit.components).toHaveLength(2) // and1, xor1

      const circuit2Data = savedData.schematicComponents['circuit_2']
      expect(circuit2Data.definition.name).toBe('4-bit Adder')
      expect(circuit2Data.circuit.components).toHaveLength(4) // 4 x 1-bit adders
      expect(
        circuit2Data.circuit.components.every(
          comp => comp.type === 'schematic-component' && comp.props?.circuitId === 'circuit_1'
        )
      ).toBe(true)

      const circuit3Data = savedData.schematicComponents['circuit_3']
      expect(circuit3Data.definition.name).toBe('8-bit Adder')
      expect(circuit3Data.circuit.components).toHaveLength(2) // 2 x 4-bit adders
      expect(
        circuit3Data.circuit.components.every(
          comp => comp.type === 'schematic-component' && comp.props?.circuitId === 'circuit_2'
        )
      ).toBe(true)
    })

    it('should preserve component properties and interfaces in deep trees', async () => {
      await appController.saveCircuit(mockCanvasRef)

      // Check that interfaces are preserved at all levels
      const circuit1Data = savedData.schematicComponents['circuit_1']
      expect(circuit1Data.circuit.properties?.interface).toEqual({
        inputs: ['A', 'B', 'Cin'],
        outputs: ['Sum', 'Cout']
      })

      const circuit2Data = savedData.schematicComponents['circuit_2']
      expect(circuit2Data.circuit.properties?.interface).toEqual({
        inputs: ['A[3:0]', 'B[3:0]', 'Cin'],
        outputs: ['Sum[3:0]', 'Cout']
      })

      const circuit3Data = savedData.schematicComponents['circuit_3']
      expect(circuit3Data.circuit.properties?.interface).toEqual({
        inputs: ['A[7:0]', 'B[7:0]', 'Cin'],
        outputs: ['Sum[7:0]', 'Cout']
      })
    })

    it('should save wires and connections in hierarchical components', async () => {
      await appController.saveCircuit(mockCanvasRef)

      // Verify wires are preserved at each level
      const circuit1Data = savedData.schematicComponents['circuit_1']
      expect(circuit1Data.circuit.wires).toHaveLength(1)
      expect(circuit1Data.circuit.wires[0].id).toBe('wire1')

      const circuit2Data = savedData.schematicComponents['circuit_2']
      expect(circuit2Data.circuit.wires).toHaveLength(3)
      expect(circuit2Data.circuit.wires.map(w => w.id)).toEqual(['wire2', 'wire3', 'wire4'])

      const circuit3Data = savedData.schematicComponents['circuit_3']
      expect(circuit3Data.circuit.wires).toHaveLength(1)
      expect(circuit3Data.circuit.wires[0].id).toBe('wire5')
    })
  })

  describe('unused component saving', () => {
    it('should save unused schematic components', async () => {
      await appController.saveCircuit(mockCanvasRef)

      // Verify unused components are included
      expect(savedData.schematicComponents).toHaveProperty('circuit_unused_1')
      expect(savedData.schematicComponents).toHaveProperty('circuit_unused_2')

      const unusedComp1 = savedData.schematicComponents['circuit_unused_1']
      expect(unusedComp1.definition.name).toBe('Unused Multiplier')
      expect(unusedComp1.circuit.components).toHaveLength(2)

      const unusedComp2 = savedData.schematicComponents['circuit_unused_2']
      expect(unusedComp2.definition.name).toBe('Unused Comparator')
      expect(unusedComp2.circuit.components).toHaveLength(2)
    })

    it('should save all components even when none are used in current circuit', async () => {
      // Set active circuit to one with no schematic components
      const simpleCircuit = {
        id: 'simple_circuit',
        name: 'Simple Circuit',
        components: [
          { id: 'gate1', type: 'and', x: 100, y: 100 },
          { id: 'gate2', type: 'or', x: 200, y: 100 }
        ],
        wires: [{ id: 'simple_wire', from: 'gate1', to: 'gate2' }]
      }

      mockCanvasRef.components = simpleCircuit.components
      mockCanvasRef.wires = simpleCircuit.wires

      await appController.saveCircuit(mockCanvasRef)

      // All available components should still be saved
      expect(Object.keys(savedData.schematicComponents)).toHaveLength(5)
      expect(savedData.schematicComponents).toHaveProperty('circuit_1')
      expect(savedData.schematicComponents).toHaveProperty('circuit_2')
      expect(savedData.schematicComponents).toHaveProperty('circuit_3')
      expect(savedData.schematicComponents).toHaveProperty('circuit_unused_1')
      expect(savedData.schematicComponents).toHaveProperty('circuit_unused_2')
    })

    it('should preserve unused component interfaces and properties', async () => {
      await appController.saveCircuit(mockCanvasRef)

      const unusedComp1 = savedData.schematicComponents['circuit_unused_1']
      expect(unusedComp1.circuit.properties?.interface).toEqual({
        inputs: ['A', 'B'],
        outputs: ['Product']
      })

      const unusedComp2 = savedData.schematicComponents['circuit_unused_2']
      expect(unusedComp2.circuit.properties?.interface).toEqual({
        inputs: ['A', 'B'],
        outputs: ['Equal']
      })
    })
  })

  describe('nextCircuitId persistence', () => {
    it('should save nextCircuitId to prevent ID collisions', async () => {
      await appController.saveCircuit(mockCanvasRef)

      expect(savedData.nextCircuitId).toBe(6)
      expect(mockCircuitManager.exportState).toHaveBeenCalled()
    })

    it('should include nextCircuitId in save parameters', async () => {
      await appController.saveCircuit(mockCanvasRef)

      expect(mockSaveCircuitFn).toHaveBeenCalledWith(
        mockCanvasRef.components,
        mockCanvasRef.wires,
        mockCanvasRef.wireJunctions,
        expect.any(Object), // circuitMetadata
        expect.any(Object), // schematicComponents
        6, // nextCircuitId
        null, // projectContext
        expect.anything() // circuitManager (for serializing port geometry)
      )
    })
  })

  describe('component count validation', () => {
    it('should save correct number of components across hierarchy', async () => {
      await appController.saveCircuit(mockCanvasRef)

      // Count total components across all saved circuits
      let totalComponents = 0
      Object.values(savedData.schematicComponents).forEach(({ circuit }) => {
        totalComponents += circuit.components?.length || 0
      })

      // circuit_1: 2, circuit_2: 4, circuit_3: 2, unused_1: 2, unused_2: 2 = 12 total
      expect(totalComponents).toBe(12)
    })

    it('should maintain component relationships in deep trees', async () => {
      await appController.saveCircuit(mockCanvasRef)

      // Verify that 4-bit adder references 1-bit adder
      const circuit2 = savedData.schematicComponents['circuit_2']
      const schematicComponents = circuit2.circuit.components.filter(
        c => c.type === 'schematic-component'
      )
      expect(schematicComponents).toHaveLength(4)
      expect(schematicComponents.every(c => c.props?.circuitId === 'circuit_1')).toBe(true)

      // Verify that 8-bit adder references 4-bit adder
      const circuit3 = savedData.schematicComponents['circuit_3']
      const schematicComponents3 = circuit3.circuit.components.filter(
        c => c.type === 'schematic-component'
      )
      expect(schematicComponents3).toHaveLength(2)
      expect(schematicComponents3.every(c => c.props?.circuitId === 'circuit_2')).toBe(true)
    })
  })
})
