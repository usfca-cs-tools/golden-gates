import { GRID_SIZE } from './constants'
import { createGateRegistryEntry, rotateConnections } from './componentFactory'
import { gateDefinitions } from '../config/gateDefinitions'

// Static imports for all components
import InputNode from '../components/InputNode.vue'
import OutputNode from '../components/OutputNode.vue'
import ConstantNode from '../components/ConstantNode.vue'
import ClockNode from '../components/ClockNode.vue'
import SplitterComponent from '../components/SplitterComponent.vue'
import MergerComponent from '../components/MergerComponent.vue'
import TunnelComponent from '../components/TunnelComponent.vue'
import MultiplexerNode from '../components/MultiplexerNode.vue'
import Decoder from '../components/Decoder.vue'
import Register from '../components/Register.vue'
import PriorityEncoder from '../components/PriorityEncoder.vue'
import SchematicComponent from '../components/SchematicComponent.vue'
import ROM from '../components/ROM.vue'
import RAM from '../components/RAM.vue'
import Adder from '../components/Adder.vue'
import Subtract from '../components/Subtract.vue'
import Multiply from '../components/Multiply.vue'
import Divide from '../components/Divide.vue'
import Shift from '../components/Shift.vue'
import Compare from '../components/Compare.vue'
import TestNode from '../components/TestNode.vue'

// Registry of all available circuit components
export const componentRegistry = {
  // Logic gates - generated from gateDefinitions
  'and-gate': createGateRegistryEntry('and', gateDefinitions.and),
  'or-gate': createGateRegistryEntry('or', gateDefinitions.or),
  'xor-gate': createGateRegistryEntry('xor', gateDefinitions.xor),
  'not-gate': createGateRegistryEntry('not', gateDefinitions.not),
  'nand-gate': createGateRegistryEntry('nand', gateDefinitions.nand),
  'nor-gate': createGateRegistryEntry('nor', gateDefinitions.nor),
  'xnor-gate': createGateRegistryEntry('xnor', gateDefinitions.xnor),

  input: {
    component: InputNode,
    label: 'Add Input',
    icon: 'pi pi-circle',
    category: 'io',
    defaultProps: {
      value: 0,
      base: 10,
      bits: 1,
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE,
      height: GRID_SIZE
    },
    // Visual bounds relative to the component's x,y position
    bounds: {
      x: -10, // Extended left to accommodate longer values
      y: -30, // Extended up to include value text
      width: GRID_SIZE + 20, // Extra width for value display
      height: 45 // Height to include value text above
    },
    // Visual center relative to the component's x,y position
    center: {
      x: GRID_SIZE / 2,
      y: 0
    },
    connections: {
      outputs: [
        { name: '0', x: 1, y: 0 } // 1 grid unit right, 0 units down
      ]
    },
    // Special handling for input nodes
    onCreate: (instance, index) => {
      instance.props.label = String.fromCharCode(65 + index) // A, B, C, etc.
    }
  },

  output: {
    component: OutputNode,
    label: 'Add Output',
    icon: 'pi pi-circle-fill',
    category: 'io',
    defaultProps: {
      value: 0,
      bits: 1,
      base: 10,
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE,
      height: GRID_SIZE
    },
    // Visual bounds relative to the component's x,y position
    bounds: {
      x: -10, // Extended left to accommodate longer values
      y: -30, // Extended up to include value text
      width: GRID_SIZE + 20, // Extra width for value display
      height: 45 // Height to include value text above
    },
    // Visual center relative to the component's x,y position
    center: {
      x: GRID_SIZE / 2,
      y: 0
    },
    connections: {
      inputs: [
        { name: '0', x: 0, y: 0 } // At component origin (already in grid units)
      ]
    },
    // Special handling for output nodes
    onCreate: (instance, index) => {
      instance.props.label = String.fromCharCode(82 + index) // R, S, T, etc.
    }
  },

  constant: {
    component: ConstantNode,
    label: 'Add Constant',
    icon: 'pi pi-stop-circle',
    category: 'io',
    defaultProps: {
      value: 0,
      base: 10,
      bits: 1,
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE,
      height: GRID_SIZE
    },
    // Visual bounds relative to the component's x,y position
    bounds: {
      x: -10, // Extended left to accommodate longer values
      y: -30, // Extended up to include value text
      width: GRID_SIZE + 20, // Extra width for value display
      height: 45 // Height to include value text above
    },
    // Visual center relative to the component's x,y position
    center: {
      x: GRID_SIZE / 2,
      y: 0
    },
    connections: {
      outputs: [
        { name: '0', x: 1, y: 0 } // 1 grid unit right, 0 units down
      ]
    },
    // Special handling for constant nodes
    onCreate: (instance, index) => {
      instance.props.label = `C${index}` // C0, C1, C2, etc.
    }
  },

  clock: {
    component: ClockNode,
    label: 'Add Clock',
    icon: 'pi pi-clock',
    category: 'io',
    defaultProps: {
      frequency: 1,
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE,
      height: GRID_SIZE
    },
    // Visual bounds relative to the component's x,y position
    bounds: {
      x: -10, // Extended left to accommodate longer values
      y: -30, // Extended up to include frequency text
      width: GRID_SIZE + 20, // Extra width for frequency display
      height: 45 // Height to include frequency text above
    },
    // Visual center relative to the component's x,y position
    center: {
      x: GRID_SIZE / 2,
      y: 0
    },
    connections: {
      outputs: [
        { name: '0', x: 1, y: 0 } // 1 grid unit right, 0 units down
      ]
    },
    // Special handling for clock nodes
    onCreate: (instance, index) => {
      instance.props.label = `CLK${index}` // CLK0, CLK1, CLK2, etc.
    }
  },

  splitter: {
    component: SplitterComponent,
    label: 'Splitter',
    icon: 'pi pi-share-alt',
    category: 'wires',
    defaultProps: {
      inputBits: 8,
      ranges: [
        { start: 0, end: 1 },
        { start: 2, end: 3 },
        { start: 4, end: 5 },
        { start: 6, end: 7 }
      ],
      rotation: 0
    },
    // Dynamic connections based on ranges
    getConnections: props => {
      const ranges = props.ranges || []
      const outputCount = ranges.length
      const minHeight = 4 // Minimum height in grid units
      const totalHeight = Math.max(minHeight, outputCount + 1) // More spacing in grid units

      // Single input on the left, centered
      const inputs = [
        {
          name: '0',
          x: 0,
          y: Math.round(totalHeight / 2) // In grid units
        }
      ]

      // Multiple outputs on the right, evenly spaced with proper margins
      const outputs = ranges.map((_, index) => {
        let y
        if (outputCount === 1) {
          y = totalHeight / 2
        } else {
          // Add top and bottom margins, distribute the rest evenly
          const topMargin = 1 // 1 grid unit margin
          const bottomMargin = 1 // 1 grid unit margin
          const availableHeight = totalHeight - topMargin - bottomMargin
          const spacing = availableHeight / (outputCount - 1)
          y = topMargin + index * spacing
        }
        // Snap to grid
        y = Math.round(y)
        return {
          name: index.toString(),
          x: 2, // 2 grid units right
          y
        }
      })

      return { inputs, outputs }
    },
    getPythonProps: props => ({
      label: props.label,
      bits: props.inputBits,
      merges: (props.ranges || []).map(r => [r.start, r.end])
    }),
    getDimensions: props => {
      const outputCount = (props.ranges || []).length
      const minHeight = 4 * GRID_SIZE // Increased minimum height
      const height = Math.max(minHeight, (outputCount + 1) * GRID_SIZE) // More spacing
      return {
        width: 2 * GRID_SIZE,
        height: height
      }
    }
  },

  merger: {
    component: MergerComponent,
    label: 'Merger',
    icon: 'pi pi-sign-in',
    category: 'wires',
    defaultProps: {
      outputBits: 8,
      ranges: [
        { start: 0, end: 1 },
        { start: 2, end: 3 },
        { start: 4, end: 5 },
        { start: 6, end: 7 }
      ],
      rotation: 0
    },
    // Dynamic connections based on ranges
    getConnections: props => {
      const ranges = props.ranges || []
      const inputCount = ranges.length
      const minHeight = 4 // Minimum height in grid units
      const totalHeight = Math.max(minHeight, inputCount + 1) // More spacing in grid units

      // Multiple inputs on the left, evenly spaced with proper margins
      const inputs = ranges.map((_, index) => {
        let y
        if (inputCount === 1) {
          y = totalHeight / 2
        } else {
          // Add top and bottom margins, distribute the rest evenly
          const topMargin = 1 // 1 grid unit margin
          const bottomMargin = 1 // 1 grid unit margin
          const availableHeight = totalHeight - topMargin - bottomMargin
          const spacing = availableHeight / (inputCount - 1)
          y = topMargin + index * spacing
        }
        // Snap to grid
        y = Math.round(y)
        return {
          name: index.toString(),
          x: 0,
          y
        }
      })

      // Single output on the right, centered
      const outputs = [
        {
          name: '0',
          x: 2, // 2 grid units right
          y: Math.round(totalHeight / 2) // In grid units
        }
      ]

      return { inputs, outputs }
    },
    getPythonProps: props => ({
      label: props.label,
      bits: props.outputBits,
      merges: (props.ranges || []).map(r => [r.start, r.end])
    }),
    getDimensions: props => {
      const inputCount = (props.ranges || []).length
      const minHeight = 4 * GRID_SIZE // Increased minimum height
      const height = Math.max(minHeight, (inputCount + 1) * GRID_SIZE) // More spacing
      return {
        width: 2 * GRID_SIZE,
        height: height
      }
    }
  },
  tunnel: {
    component: TunnelComponent,
    label: 'Tunnel',
    icon: 'pi pi-exclamation-triangle',
    category: 'wires',
    defaultProps: {
      bits: 1,
      label: '',
      rotation: 0,
      direction: 'input'
    },
    getConnections: props => {
      const centerY = Math.round(GRID_SIZE / 2 / GRID_SIZE)
      if (props.direction === 'output') {
        return {
          outputs: [{ name: '0', x: 2, y: centerY }]
        }
      } else {
        // Default to input
        return {
          inputs: [{ name: '0', x: 0, y: centerY }]
        }
      }
    },
    getPythonProps: props => ({
      label: props.label,
      bits: props.bits
    }),
    getDimensions: () => ({
      width: 2 * GRID_SIZE,
      height: GRID_SIZE
    })
  },
  multiplexer: {
    component: MultiplexerNode,
    label: 'Multiplexer',
    icon: 'pi pi-share-alt',
    category: 'components',
    defaultProps: {
      selectorBits: 2,
      bits: 1,
      label: '',
      selectorPosition: 'bottom',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 2,
      height: GRID_SIZE * 3
    },
    // Dynamic connections based on selectorBits
    getConnections: props => {
      const numInputs = Math.pow(2, props.selectorBits || 2)

      // Calculate height same as Vue component
      const inputSpacing = 2 // 2 grid units between inputs
      const baseHeight = (numInputs - 1) * inputSpacing
      const minHeight = 4 // Minimum height in grid units
      const totalHeight = Math.max(baseHeight + 2, minHeight) // Add 1 grid unit margin top/bottom

      // Input connections on the left - match Vue component getInputY method
      const inputs = []
      const margin = 1 // 1 grid unit margin from top
      for (let i = 0; i < numInputs; i++) {
        inputs.push({
          name: i.toString(),
          x: 0,
          y: margin + i * inputSpacing
        })
      }

      // Selector input (special port named 'sel')
      inputs.push({
        name: 'sel',
        x: 1, // Center of 2-unit wide component
        y: props.selectorPosition === 'top' ? 0 : totalHeight
      })

      // Single output on the right
      const outputs = [
        {
          name: '0',
          x: 2,
          y: Math.round(totalHeight / 2)
        }
      ]

      // Rotate ports around the output point to match MultiplexerNode.vue's
      // rotate(rotation, outputX, outputY) — so wire endpoints/validation/serialization
      // land where the dots are actually drawn.
      return rotateConnections({ inputs, outputs }, props.rotation || 0, {
        x: 2,
        y: Math.round(totalHeight / 2)
      })
    },
    getDimensions: props => {
      const numInputs = Math.pow(2, props.selectorBits || 2)

      // Calculate height same as Vue component and getConnections
      const inputSpacing = 2 // 2 grid units between inputs
      const baseHeight = (numInputs - 1) * inputSpacing
      const minHeight = 4 // Minimum height in grid units
      const totalHeight = Math.max(baseHeight + 2, minHeight) // Add 1 grid unit margin top/bottom

      return {
        width: 2 * GRID_SIZE,
        height: totalHeight * GRID_SIZE
      }
    },
    // Special handling for multiplexer creation
    onCreate: (instance, index) => {
      instance.props.label = instance.props.label || `MUX${index}`
    }
  },

  decoder: {
    component: Decoder,
    label: 'Decoder',
    icon: 'pi pi-sitemap',
    category: 'components',
    requiresNamedPorts: true,
    defaultProps: {
      selectorBits: 2,
      label: 'DEC',
      selectorPosition: 'bottom',
      rotation: 0
    },
    getConnections: props => {
      const numOutputs = Math.pow(2, props.selectorBits || 2)
      const selectorPosition = props.selectorPosition || 'bottom'

      // Calculate height same as Vue component
      const outputSpacing = 2
      const baseHeight = (numOutputs - 1) * outputSpacing
      const totalHeight = Math.max(baseHeight + 2, 4)

      // Single selector input at center, top or bottom based on prop
      const inputs = [
        {
          name: 'sel',
          x: 1, // Center of 2-unit wide component
          y: selectorPosition === 'top' ? 0 : totalHeight
        }
      ]

      // Output connections on the right - match Vue component getOutputY method
      const outputs = []
      const firstOutputY = 1 // First output at 1 grid unit from top
      for (let i = 0; i < numOutputs; i++) {
        outputs.push({
          name: i.toString(),
          x: 2, // Right edge of 2-unit wide component
          y: firstOutputY + i * 2 // 2 grid units between outputs
        })
      }

      return { inputs, outputs }
    },
    getDimensions: props => {
      const numOutputs = Math.pow(2, props.selectorBits || 2)
      const outputSpacing = 2
      const baseHeight = (numOutputs - 1) * outputSpacing
      const totalHeight = Math.max(baseHeight + 2, 4)

      return {
        width: GRID_SIZE * 2, // Match multiplexer width
        height: GRID_SIZE * totalHeight
      }
    },
    // Special handling for decoder creation
    onCreate: (instance, index) => {
      instance.props.label = instance.props.label || `DEC${index}`
    }
  },

  register: {
    component: Register,
    label: 'Register',
    icon: 'pi pi-stop',
    category: 'memory',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 1,
      label: 'REG'
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 6
    },
    connections: {
      inputs: [
        { name: 'D', x: 0, y: 1 }, // Data input (top)
        { name: 'CLK', x: 0, y: 3 }, // Clock input (middle)
        { name: 'en', x: 0, y: 5 } // Enable input (bottom)
      ],
      outputs: [
        { name: 'Q', x: 4, y: 3 } // Output (right, center)
      ]
    },
    onCreate: (instance, index) => {
      instance.props.label = `REG${index}`
    }
  },

  rom: {
    component: ROM,
    label: 'ROM',
    icon: 'pi pi-database',
    category: 'memory',
    requiresNamedPorts: true,
    defaultProps: {
      addressBits: 4,
      dataBits: 8,
      data: [],
      label: 'ROM'
    },
    // Dynamic connections based on addressBits
    getConnections: props => {
      const addressBits = props.addressBits || 4
      // Dynamic size based on address bits (min 4x5 to accommodate 2 grid unit spacing)
      const width = Math.max(4, Math.ceil(addressBits / 2))
      const height = Math.max(5, Math.ceil(addressBits / 2) + 1)

      return {
        inputs: [
          { name: 'A', x: 0, y: 1 }, // Address input (grid-aligned)
          { name: 'sel', x: 0, y: 3 } // Select input (2 grid units apart, grid-aligned)
        ],
        outputs: [
          { name: 'D', x: width, y: Math.floor(height / 2) } // Data output (center right, grid-aligned)
        ]
      }
    },
    getDimensions: props => {
      const addressBits = props.addressBits || 4
      // Dynamic size based on address bits (min 4x4)
      const width = Math.max(4, Math.ceil(addressBits / 2))
      const height = Math.max(4, Math.ceil(addressBits / 2))

      return {
        width: width * GRID_SIZE,
        height: height * GRID_SIZE
      }
    },
    onCreate: (instance, index) => {
      instance.props.label = `ROM${index}`
      // Initialize empty data array
      const totalCells = Math.pow(2, instance.props.addressBits || 4)
      instance.props.data = new Array(totalCells).fill(0)
    }
  },
  ram: {
    component: RAM,
    label: 'RAM',
    icon: 'pi pi-server',
    category: 'memory',
    requiresNamedPorts: true,
    defaultProps: {
      addressBits: 4,
      dataBits: 8,
      data: [],
      label: 'RAM'
    },
    // Dynamic connections based on addressBits
    getConnections: props => {
      const addressBits = props.addressBits || 4
      // Dynamic size based on address bits - larger than ROM to accommodate more inputs
      const width = Math.max(5, Math.ceil(addressBits / 2) + 1)
      const height = Math.max(7, Math.ceil(addressBits / 2) + 3)
      return {
        inputs: [
          { name: 'A', x: 0, y: 1 }, // Address input
          { name: 'Din', x: 0, y: 2 }, // Data input
          { name: 'ld', x: 0, y: 3 }, // Load input
          { name: 'st', x: 0, y: 4 }, // Store input
          { name: 'CLK', x: 0, y: 5 } // Clock input
        ],
        outputs: [
          { name: 'D', x: width, y: Math.floor(height / 2) } // Data output (center right, grid-aligned)
        ]
      }
    },
    getDimensions: props => {
      const addressBits = props.addressBits || 4
      // Dynamic size based on address bits - larger than ROM
      const width = Math.max(5, Math.ceil(addressBits / 2) + 1)
      const height = Math.max(7, Math.ceil(addressBits / 2) + 3)
      return {
        width: width * GRID_SIZE,
        height: height * GRID_SIZE
      }
    },
    onCreate: (instance, index) => {
      instance.props.label = `RAM${index}`
      // Initialize empty data array
      const totalCells = Math.pow(2, instance.props.addressBits || 4)
      instance.props.data = new Array(totalCells).fill(0)
    }
  },

  adder: {
    component: Adder,
    label: 'Adder',
    icon: 'pi pi-plus',
    category: 'arithmetic',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 8,
      label: '+',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 6
    },
    connections: {
      inputs: [
        { name: 'a', x: 0, y: 1 }, // a input (top)
        { name: 'b', x: 0, y: 3 }, // b input (middle)
        { name: 'cin', x: 0, y: 5 } // cin input (bottom)
      ],
      outputs: [
        { name: 'sum', x: 4, y: 2 }, // sum output (top)
        { name: 'cout', x: 4, y: 4 } // cout output (bottom)
      ]
    },
    onCreate: (instance, index) => {
      // Don't override if it already has a label (including default '+')
      if (!instance.props.label || instance.props.label === '') {
        instance.props.label = '+'
      }
    }
  },

  subtract: {
    component: Subtract,
    label: 'Subtract',
    icon: 'pi pi-minus',
    category: 'arithmetic',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 8,
      label: '-',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 6
    },
    connections: {
      inputs: [
        { name: 'a', x: 0, y: 1 }, // a input (top)
        { name: 'b', x: 0, y: 3 }, // b input (middle)
        { name: 'cin', x: 0, y: 5 } // cin input (bottom)
      ],
      outputs: [
        { name: 's', x: 4, y: 2 }, // s output (top)
        { name: 'cout', x: 4, y: 4 } // cout output (bottom)
      ]
    },
    onCreate: (instance, index) => {
      // Don't override if it already has a label (including default '-')
      if (!instance.props.label || instance.props.label === '') {
        instance.props.label = '-'
      }
    }
  },

  multiply: {
    component: Multiply,
    label: 'Multiply',
    icon: 'pi pi-times',
    category: 'arithmetic',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 8,
      label: '×',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 4
    },
    connections: {
      inputs: [
        { name: 'a', x: 0, y: 1 }, // a input (top)
        { name: 'b', x: 0, y: 3 } // b input (bottom)
      ],
      outputs: [
        { name: 'mul', x: 4, y: 2 } // mul output (center)
      ]
    },
    onCreate: (instance, index) => {
      // Don't override if it already has a label (including default '×')
      if (!instance.props.label || instance.props.label === '') {
        instance.props.label = '×'
      }
    }
  },

  divide: {
    component: Divide,
    label: 'Divide',
    icon: 'pi pi-divide',
    category: 'arithmetic',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 8,
      label: '÷',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 4
    },
    connections: {
      inputs: [
        { name: 'a', x: 0, y: 1 }, // a input (top)
        { name: 'b', x: 0, y: 3 } // b input (bottom)
      ],
      outputs: [
        { name: 'q', x: 4, y: 1 }, // q output (quotient - top)
        { name: 'r', x: 4, y: 3 } // r output (remainder - bottom)
      ]
    },
    onCreate: (instance, index) => {
      // Don't override if it already has a label (including default '÷')
      if (!instance.props.label || instance.props.label === '') {
        instance.props.label = '÷'
      }
    }
  },

  shift: {
    component: Shift,
    label: 'Shift',
    icon: 'pi pi-arrow-left',
    category: 'arithmetic',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 8,
      label: '<<',
      mode: 'logical_left',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 4
    },
    connections: {
      inputs: [
        { name: 'in', x: 0, y: 1 }, // in input (top)
        { name: 'shift', x: 0, y: 3 } // shift input (bottom)
      ],
      outputs: [
        { name: 'out', x: 4, y: 2 } // out output (center)
      ]
    },
    onCreate: (instance, index) => {
      // Don't override if it already has a label (including default '<<')
      if (!instance.props.label || instance.props.label === '') {
        instance.props.label = '<<'
      }
    }
  },

  compare: {
    component: Compare,
    label: 'Compare',
    icon: 'pi pi-equals',
    category: 'arithmetic',
    requiresNamedPorts: true,
    defaultProps: {
      bits: 8,
      label: '=',
      rotation: 0
    },
    dimensions: {
      width: GRID_SIZE * 4,
      height: GRID_SIZE * 6
    },
    connections: {
      inputs: [
        { name: 'a', x: 0, y: 2 }, // a input (top)
        { name: 'b', x: 0, y: 4 } // b input (bottom)
      ],
      outputs: [
        { name: 'lt', x: 4, y: 1 }, // lt output (less than - top)
        { name: 'eq', x: 4, y: 3 }, // eq output (equal - middle)
        { name: 'gt', x: 4, y: 5 } // gt output (greater than - bottom)
      ]
    },
    onCreate: (instance, index) => {
      // Don't override if it already has a label (including default '=')
      if (!instance.props.label || instance.props.label === '') {
        instance.props.label = '='
      }
    }
  },

  priorityEncoder: {
    component: PriorityEncoder,
    label: 'Priority Encoder',
    icon: 'pi pi-list',
    category: 'components',
    requiresNamedPorts: true,
    defaultProps: {
      selectorBits: 2,
      label: 'PE',
      rotation: 0
    },
    getConnections: props => {
      const numInputs = Math.pow(2, props.selectorBits || 2)

      // Calculate height same as Vue component
      const inputSpacing = 2
      const baseHeight = (numInputs - 1) * inputSpacing
      const totalHeight = Math.max(baseHeight + 2, 6)

      // Input connections on the left - numbered inputs
      const inputs = []
      const margin = 1 // 1 grid unit margin from top
      for (let i = 0; i < numInputs; i++) {
        inputs.push({
          name: i.toString(),
          x: 0,
          y: margin + i * 2 // 2 grid units between inputs
        })
      }

      // Two fixed outputs on the right: inum and any
      const outputs = [
        {
          name: 'inum',
          x: 3, // Right edge of 3-unit wide component
          y: Math.round(totalHeight / 3) // 1/3 height
        },
        {
          name: 'any',
          x: 3, // Right edge of 3-unit wide component
          y: Math.round((totalHeight * 2) / 3) // 2/3 height
        }
      ]

      return { inputs, outputs }
    },
    getDimensions: props => {
      const numInputs = Math.pow(2, props.selectorBits || 2)
      const inputSpacing = 2
      const baseHeight = (numInputs - 1) * inputSpacing
      const totalHeight = Math.max(baseHeight + 2, 6)

      return {
        width: GRID_SIZE * 3, // 3 grid units wide
        height: GRID_SIZE * totalHeight
      }
    },
    // Special handling for priority encoder creation
    onCreate: (instance, index) => {
      instance.props.label = instance.props.label || `PE${index}`
    }
  },

  test: {
    component: TestNode,
    label: 'Test',
    icon: 'pi pi-check-square',
    category: 'io',
    // A Test is a verification directive with NO connection ports.
    // It holds a truth table over named Inputs/Outputs.
    defaultProps: {
      label: 'TEST',
      table: { inputNames: [], outputNames: [], rows: [] },
      status: 'pending',
      // Clocked "stop when an output reaches a value" mode (off by default)
      stop_enabled: false,
      stop_output_name: '',
      stop_output_value: 1,
      // Reset pulse to initialize sequential circuits before the run (off by default)
      reset_enabled: false,
      reset_input_name: ''
    },
    connections: {
      inputs: [],
      outputs: []
    },
    // Dynamic size grows with the number of rows and total columns
    getDimensions: props => {
      const table = props.table || {}
      const columnCount =
        (table.inputNames?.length || 0) + (table.outputNames?.length || 0)
      const rowCount = table.rows?.length || 0
      const contentRows = (columnCount > 0 ? 1 : 0) + rowCount
      return {
        width: Math.max(GRID_SIZE * 5, GRID_SIZE * (columnCount * 1.5 + 1)),
        height: Math.max(GRID_SIZE * 3, GRID_SIZE * (contentRows + 2))
      }
    },
    // Give each new test a unique label: TEST0, TEST1, ...
    onCreate: (instance, index) => {
      instance.props.label = `TEST${index}`
    }
  },

  'schematic-component': {
    component: SchematicComponent,
    label: 'Schematic Component',
    icon: 'pi pi-cube',
    category: 'components',
    defaultProps: {
      circuitId: '',
      label: 'Component'
    },
    // Dynamic connections based on the circuit it represents
    getConnections: (props, circuitManager) => {
      if (!props.circuitId || !circuitManager) {
        // Default single input/output if no circuit specified
        return {
          inputs: [{ x: 0, y: 0 }],
          outputs: [{ x: 6, y: 0 }] // Default width of 6 grid units
        }
      }

      const circuit = circuitManager.getCircuit(props.circuitId)
      if (!circuit) {
        return {
          inputs: [{ x: 0, y: 0 }],
          outputs: [{ x: 6, y: 0 }] // 6 grid units wide
        }
      }

      // Analyze circuit to find inputs and outputs
      const inputs = []
      const outputs = []

      circuit.components.forEach(component => {
        if (component.type === 'input') {
          inputs.push({
            id: component.id,
            label: component.props?.label || 'IN',
            bits: component.props?.bits || 1,
            rotation: component.props?.rotation || 0
          })
        } else if (component.type === 'output') {
          outputs.push({
            id: component.id,
            label: component.props?.label || 'OUT',
            bits: component.props?.bits || 1,
            rotation: component.props?.rotation || 0
          })
        }
      })

      // Calculate grid-aligned dimensions
      const maxPorts = Math.max(inputs.length, outputs.length, 1)
      const minHeight = 4 // 2 above + 2 below (in grid units)
      const heightForPorts = maxPorts * 2 // 2 grid units per port
      const height = Math.max(minHeight, heightForPorts)
      const width = 6 // 6 grid units wide

      // Calculate connection positions
      const inputConnections =
        inputs.length === 0
          ? [{ x: 0, y: Math.round(height / 2) }]
          : inputs.map((input, index) => {
              let y
              if (inputs.length === 1) {
                // Single input at center
                y = height / 2
              } else {
                // Multiple inputs: use consistent 2 grid unit spacing
                const topMargin = 1 // 1 grid unit from top
                const inputSpacing = 2 // 2 grid units per input
                y = topMargin + index * inputSpacing
              }

              // Snap to nearest grid vertex
              y = Math.round(y)

              // Move connection points to different edges based on rotation
              const rotation = input.rotation || 0
              let connectionPoint = { x: 0, y }

              if (rotation === 90) {
                // Input rotated 90°: connection point moves to top edge
                connectionPoint = { x: width / 2, y: 0 }
              } else if (rotation === 180) {
                // Input rotated 180°: connection point moves to right edge
                connectionPoint = { x: width, y: y }
              } else if (rotation === 270) {
                // Input rotated 270°: connection point moves to bottom edge
                connectionPoint = { x: width / 2, y: height }
              }
              // 0° rotation stays at left edge (default)

              // Preserve the label information for code generation
              return {
                ...connectionPoint,
                label: input.label,
                id: input.id,
                bits: input.bits
              }
            })

      const outputConnections =
        outputs.length === 0
          ? [{ x: width, y: Math.round(height / 2) }]
          : outputs.map((output, index) => {
              let y
              if (outputs.length === 1) {
                // Single output at center
                y = height / 2
              } else {
                // Multiple outputs: use consistent 2 grid unit spacing
                const topMargin = 1 // 1 grid unit from top
                const outputSpacing = 2 // 2 grid units per output
                y = topMargin + index * outputSpacing
              }

              // Snap to nearest grid vertex
              y = Math.round(y)

              // Move connection points to different edges based on rotation
              const rotation = output.rotation || 0
              let connectionPoint = { x: width, y }

              if (rotation === 90) {
                // Output rotated 90°: connection point moves to bottom edge
                connectionPoint = { x: width / 2, y: height }
              } else if (rotation === 180) {
                // Output rotated 180°: connection point moves to left edge
                connectionPoint = { x: 0, y: y }
              } else if (rotation === 270) {
                // Output rotated 270°: connection point moves to top edge
                connectionPoint = { x: width / 2, y: 0 }
              }
              // 0° rotation stays at right edge (default)

              // Preserve the label information for code generation
              return {
                ...connectionPoint,
                label: output.label,
                id: output.id,
                bits: output.bits
              }
            })

      return {
        inputs: inputConnections,
        outputs: outputConnections
      }
    }
  }

  // Future components can be added here:
  // 'not-gate': { ... },
  // 'xor-gate': { ... },
  // 'wire': { ... }
}

// Helper function to get component categories
export function getComponentCategories() {
  const categories = new Set()
  Object.values(componentRegistry).forEach(config => {
    if (config.category) {
      categories.add(config.category)
    }
  })
  return Array.from(categories)
}

// Helper function to get components by category
export function getComponentsByCategory(category) {
  return Object.entries(componentRegistry)
    .filter(([_, config]) => config.category === category)
    .reduce((acc, [type, config]) => {
      acc[type] = config
      return acc
    }, {})
}
