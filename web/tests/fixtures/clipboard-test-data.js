/**
 * Test fixtures and mock data for clipboard functionality tests
 */

import { vi } from 'vitest'

// Mock components for testing
export const mockComponents = {
  singleInput: {
    id: 'input_1_1234567890',
    type: 'input',
    x: 10,
    y: 15,
    props: {
      label: 'A',
      bits: 1,
      base: 2,
      value: 0
    }
  },

  singleOutput: {
    id: 'output_1_1234567890',
    type: 'output',
    x: 25,
    y: 15,
    props: {
      label: 'R',
      bits: 1
    }
  },

  andGate: {
    id: 'and-gate_1_1234567890',
    type: 'and-gate',
    x: 18,
    y: 20,
    props: {
      bits: 1,
      inputs: 2
    }
  },

  splitter: {
    id: 'splitter_1_1234567890',
    type: 'splitter',
    x: 30,
    y: 25,
    props: {
      bits: 8,
      splits: [
        { low: 0, high: 3 },
        { low: 4, high: 7 }
      ]
    }
  },

  merger: {
    id: 'merger_1_1234567890',
    type: 'merger',
    x: 35,
    y: 30,
    props: {
      bits: 8,
      merges: [
        { low: 0, high: 3 },
        { low: 4, high: 7 }
      ]
    }
  },

  schematicComponent: {
    id: 'schematic-component_1_1234567890',
    type: 'schematic-component',
    x: 40,
    y: 35,
    props: {
      circuitId: 'circuit_1',
      label: 'SubCircuit'
    }
  }
}

// Mock wires for testing
export const mockWires = {
  simpleWire: {
    id: 'wire_1_1234567890',
    points: [
      { x: 15, y: 15 },
      { x: 18, y: 15 }
    ],
    startConnection: {
      componentId: 'input_1_1234567890',
      portIndex: 0,
      portType: 'output',
      pos: { x: 15, y: 15 }
    },
    endConnection: {
      componentId: 'and-gate_1_1234567890',
      portIndex: 0,
      portType: 'input',
      pos: { x: 18, y: 15 }
    }
  },

  multiPointWire: {
    id: 'wire_2_1234567890',
    points: [
      { x: 20, y: 20 },
      { x: 22, y: 20 },
      { x: 22, y: 25 },
      { x: 25, y: 25 }
    ],
    startConnection: {
      componentId: 'and-gate_1_1234567890',
      portIndex: 0,
      portType: 'output',
      pos: { x: 20, y: 20 }
    },
    endConnection: {
      componentId: 'output_1_1234567890',
      portIndex: 0,
      portType: 'input',
      pos: { x: 25, y: 25 }
    }
  }
}

// Mock wire junctions for testing
export const mockJunctions = {
  simpleJunction: {
    pos: { x: 22, y: 20 },
    sourceWireIndex: 0,
    connectedWireId: 'wire_3_1234567890'
  },

  multiJunction: {
    pos: { x: 30, y: 30 },
    sourceWireIndex: 1,
    connectedWireId: 'wire_4_1234567890'
  }
}

// Mock circuit elements for testing
export const mockCircuitElements = {
  empty: {
    components: [],
    wires: [],
    junctions: []
  },

  singleComponent: {
    components: [mockComponents.singleInput],
    wires: [],
    junctions: []
  },

  simpleCircuit: {
    components: [mockComponents.singleInput, mockComponents.andGate, mockComponents.singleOutput],
    wires: [mockWires.simpleWire, mockWires.multiPointWire],
    junctions: []
  },

  complexCircuit: {
    components: [
      mockComponents.singleInput,
      mockComponents.andGate,
      mockComponents.splitter,
      mockComponents.merger,
      mockComponents.singleOutput
    ],
    wires: [mockWires.simpleWire, mockWires.multiPointWire],
    junctions: [mockJunctions.simpleJunction, mockJunctions.multiJunction]
  }
}

// Mock clipboard data for testing
export const mockClipboardData = {
  validClipboard: {
    version: '1.0',
    elements: {
      components: [
        {
          id: 'input_1_1234567890',
          type: 'input',
          x: 0, // Relative to bounds
          y: 0,
          props: {
            label: 'A',
            bits: 1,
            base: 2,
            value: 0
          }
        }
      ],
      wires: [],
      junctions: []
    },
    bounds: {
      width: 5,
      height: 5,
      originalBounds: { minX: 10, minY: 15, maxX: 15, maxY: 20 }
    },
    timestamp: 1642723200000,
    operation: 'copy'
  },

  invalidClipboard: {
    version: '1.0',
    elements: {
      components: 'invalid'
    }
  },

  oldVersionClipboard: {
    version: '0.9',
    elements: {
      components: [mockComponents.singleInput]
    }
  }
}

// Mock selection states for testing
export const mockSelectionStates = {
  empty: new Set(),

  singleComponent: new Set(['input_1_1234567890']),

  multipleComponents: new Set([
    'input_1_1234567890',
    'and-gate_1_1234567890',
    'output_1_1234567890'
  ]),

  singleWire: new Set([0]),

  multipleWires: new Set([0, 1]),

  mixed: {
    components: new Set(['input_1_1234567890', 'and-gate_1_1234567890']),
    wires: new Set([0])
  }
}

// Mock circuit model for testing
export const mockCircuitModel = {
  createMockCircuit: (elements = mockCircuitElements.empty) => ({
    id: 'test-circuit',
    name: 'Test Circuit',
    components: [...elements.components],
    wires: [...elements.wires],
    wireJunctions: [...elements.junctions],
    properties: {
      name: 'Test Circuit',
      label: 'Test Circuit'
    }
  })
}

// Mock browser clipboard API
export const mockClipboardAPI = {
  // Mock modern clipboard API
  // Stateful like a real OS clipboard: readText returns whatever was last written (starting
  // with a valid sample payload), so a copy followed by a paste round-trips.
  createMockNavigatorClipboard: (shouldFail = false) => {
    if (shouldFail) {
      return {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard write failed')),
        readText: vi.fn().mockRejectedValue(new Error('Clipboard read failed'))
      }
    }
    let contents = JSON.stringify(mockClipboardData.validClipboard)
    return {
      writeText: vi.fn(async text => {
        contents = text
      }),
      readText: vi.fn(async () => contents)
    }
  },

  // Mock execCommand for fallback
  createMockExecCommand: (shouldFail = false) => vi.fn().mockReturnValue(!shouldFail)
}

// Test utilities for clipboard operations
export const testUtils = {
  /**
   * Create a mock bounds object
   */
  createMockBounds: (minX = 0, minY = 0, maxX = 10, maxY = 10) => ({
    minX,
    minY,
    maxX,
    maxY
  }),

  /**
   * Create a mock paste position
   */
  createMockPastePosition: (x = 0, y = 0) => ({ x, y }),

  /**
   * Create a mock component with specific properties
   */
  createMockComponent: (type = 'input', overrides = {}) => ({
    id: `${type}_test_${Date.now()}`,
    type,
    x: 0,
    y: 0,
    props: {},
    ...overrides
  }),

  /**
   * Create a mock wire with specific properties
   */
  createMockWire: (overrides = {}) => ({
    id: `wire_test_${Date.now()}`,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ],
    startConnection: null,
    endConnection: null,
    ...overrides
  }),

  /**
   * Create a mock junction with specific properties
   */
  createMockJunction: (overrides = {}) => ({
    pos: { x: 0, y: 0 },
    sourceWireIndex: 0,
    connectedWireId: 'wire_test',
    ...overrides
  })
}

// Mock keyboard events for testing
export const mockKeyboardEvents = {
  copyEvent: {
    key: 'c',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    get defaultPrevented() {
      return this.preventDefault.mock.calls.length > 0
    }
  },

  pasteEvent: {
    key: 'v',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    get defaultPrevented() {
      return this.preventDefault.mock.calls.length > 0
    }
  },

  cutEvent: {
    key: 'x',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    get defaultPrevented() {
      return this.preventDefault.mock.calls.length > 0
    }
  },

  duplicateEvent: {
    key: 'd',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    get defaultPrevented() {
      return this.preventDefault.mock.calls.length > 0
    }
  },

  undoEvent: {
    key: 'z',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    get defaultPrevented() {
      return this.preventDefault.mock.calls.length > 0
    }
  },

  redoEvent: {
    key: 'y',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    get defaultPrevented() {
      return this.preventDefault.mock.calls.length > 0
    }
  }
}

// Export all fixtures
export default {
  mockComponents,
  mockWires,
  mockJunctions,
  mockCircuitElements,
  mockClipboardData,
  mockSelectionStates,
  mockCircuitModel,
  mockClipboardAPI,
  testUtils,
  mockKeyboardEvents
}
