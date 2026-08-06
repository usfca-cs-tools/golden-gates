// Gate definitions for all logic gates
// Each definition includes visual properties and code generation logic

import { GRID_SIZE } from '../utils/constants'

export const gateDefinitions = {
  and: {
    label: 'AND Gate',
    logicClass: 'And',
    pythonModule: 'logic',
    // SVG path generator for AND gate shape (MIL-STD-806B)
    getSvgPath: (h, padding) => {
      // Fixed-size AND gate: rectangle left half + semicircle right half
      // Width: 3 grid units, Height: 2 grid units
      const radius = GRID_SIZE // Half of the height for the semicircle
      return `M 0 ${-padding} L ${GRID_SIZE * 2} ${-padding} A ${radius} ${radius} 0 0 1 ${GRID_SIZE * 2} ${h + padding} L 0 ${h + padding} L 0 ${-padding} Z`
    },
    outputOffset: -10 // Move output 10px to the right to align with stroke
  },

  or: {
    label: 'OR Gate',
    logicClass: 'Or',
    pythonModule: 'logic',
    // SVG path generator for OR gate shape (MIL-STD-806B)
    getSvgPath: (h, padding) => {
      // Fixed-size OR gate: curved input side, pointed output
      // Width: 4 grid units, Height: 2 grid units
      const centerY = h / 2
      return `
        M 0 ${-padding}
        Q 12 ${-padding}, 12 ${-padding}
        Q ${GRID_SIZE * 3} ${centerY - GRID_SIZE}, ${GRID_SIZE * 4} ${centerY}
        Q ${GRID_SIZE * 3} ${centerY + GRID_SIZE}, 12 ${h + padding}
        Q 12 ${h + padding}, 0 ${h + padding}
        Q 10 ${centerY}, 0 ${-padding}
        Z
      `
    },
    outputOffset: -GRID_SIZE // Move output one grid unit to the right (60px total) to match the gate's point
  },

  // Future gates can be added here
  xor: {
    label: 'XOR Gate',
    logicClass: 'Xor',
    pythonModule: 'logic',
    getSvgPath: (h, padding) => {
      // XOR gate: OR gate body with additional concave input line (MIL-STD-806B)
      const centerY = h / 2
      return `
        M ${GRID_SIZE} ${-padding}
        Q ${GRID_SIZE + 12} ${-padding}, ${GRID_SIZE + 12} ${-padding}
        Q ${GRID_SIZE * 4} ${centerY - GRID_SIZE}, ${GRID_SIZE * 5} ${centerY}
        Q ${GRID_SIZE * 4} ${centerY + GRID_SIZE}, ${GRID_SIZE + 12} ${h + padding}
        Q ${GRID_SIZE + 12} ${h + padding}, ${GRID_SIZE} ${h + padding}
        Q ${GRID_SIZE + 10} ${centerY}, ${GRID_SIZE} ${-padding}
        Z
        M 5 ${-padding}
        Q 10 ${centerY}, 5 ${h + padding}
      `
    },
    outputOffset: -GRID_SIZE * 2, // Move output further right
    // Override input connection positions for XOR gate
    getInputPositions: numInputs => {
      const positions = []

      // Handle single input case
      if (numInputs === 1) {
        positions.push({ x: 0, y: 1 }) // Single input centered at 1 grid unit
        return positions
      }

      // Calculate total height in grid units (2 grid units per input spacing)
      const totalHeight = (numInputs - 1) * 2
      const spacing = totalHeight / (numInputs - 1)

      for (let i = 0; i < numInputs; i++) {
        positions.push({
          x: 0, // Inputs at x=0, before the concave line (in grid units)
          y: i * spacing // Distribute inputs evenly from 0 to totalHeight (in grid units)
        })
      }

      return positions
    }
  },

  not: {
    label: 'NOT Gate',
    logicClass: 'Not',
    pythonModule: 'logic',
    getSvgPath: (h, padding) => {
      // NOT gate: Triangle with negation circle (MIL-STD-806B).
      // The bubble's right edge lands on the 45px (3 grid unit) vertex so the output connection
      // point sits on the grid — see outputOffset. The triangle tip meets the bubble at 35px.
      const centerY = h / 2
      const radius = 5
      const triangleWidth = GRID_SIZE * 3 - 2 * radius // 35px: tip touches the bubble's left edge
      return `
        M 0 ${-padding}
        L ${triangleWidth} ${centerY}
        L 0 ${h + padding}
        L 0 ${-padding}
        Z
        M ${triangleWidth + 2 * radius} ${centerY}
        A ${radius} ${radius} 0 1 1 ${triangleWidth} ${centerY}
        A ${radius} ${radius} 0 1 1 ${triangleWidth + 2 * radius} ${centerY}
      `
    },
    outputOffset: 0, // Output at 3 grid units (45px): input(0)→output(45) spans 3 grid units, so a
    // 90/180/270° rotation about the output keeps both connection points on the grid.
    // NOT gate has only one input
    getInputPositions: numInputs => {
      // For NOT gate, always return single centered input
      return [{ x: 0, y: 1 }] // Single input at center (1 grid unit from top)
    },
    // NOT gate dimensions
    dimensions: {
      width: GRID_SIZE * 3, // 45px total width (triangle + circle)
      height: GRID_SIZE * 2 // Standard height
    },
    // NOT gate specific properties
    defaultNumInputs: 1 // Specify that NOT gate has only 1 input
  },

  xnor: {
    label: 'XNOR Gate',
    logicClass: 'Xnor',
    pythonModule: 'logic',
    getSvgPath: (h, padding) => {
      // XNOR gate: XOR gate body with negation circle at output (MIL-STD-806B)
      const centerY = h / 2
      return `
        M ${GRID_SIZE} ${-padding}
        Q ${GRID_SIZE + 12} ${-padding}, ${GRID_SIZE + 12} ${-padding}
        Q ${GRID_SIZE * 4} ${centerY - GRID_SIZE}, ${GRID_SIZE * 5} ${centerY}
        Q ${GRID_SIZE * 4} ${centerY + GRID_SIZE}, ${GRID_SIZE + 12} ${h + padding}
        Q ${GRID_SIZE + 12} ${h + padding}, ${GRID_SIZE} ${h + padding}
        Q ${GRID_SIZE + 10} ${centerY}, ${GRID_SIZE} ${-padding}
        Z
        M 5 ${-padding}
        Q 10 ${centerY}, 5 ${h + padding}
        M ${GRID_SIZE * 6} ${centerY}
        A 5 5 0 1 1 ${GRID_SIZE * 5} ${centerY}
        A 5 5 0 1 1 ${GRID_SIZE * 6} ${centerY}
      `
    },
    outputOffset: -GRID_SIZE * 3, // Move output further right to account for negation circle
    // Override input connection positions for XNOR gate (same as XOR)
    getInputPositions: numInputs => {
      const positions = []

      // Handle single input case
      if (numInputs === 1) {
        positions.push({ x: 0, y: 1 }) // Single input centered at 1 grid unit
        return positions
      }

      // Calculate total height in grid units (2 grid units per input spacing)
      const totalHeight = (numInputs - 1) * 2
      const spacing = totalHeight / (numInputs - 1)

      for (let i = 0; i < numInputs; i++) {
        positions.push({
          x: 0, // Inputs at x=0, before the concave line (in grid units)
          y: i * spacing // Distribute inputs evenly from 0 to totalHeight (in grid units)
        })
      }

      return positions
    }
  },

  nand: {
    label: 'NAND Gate',
    logicClass: 'Nand',
    pythonModule: 'logic',
    // SVG path generator for NAND gate shape (MIL-STD-806B)
    getSvgPath: (h, padding) => {
      // NAND gate: standard AND gate + separate negation circle
      // AND gate: rectangle + semicircle (same as regular AND gate)
      const radius = GRID_SIZE // Half of the height for the semicircle
      const centerY = h / 2
      return `
        M 0 ${-padding} 
        L ${GRID_SIZE * 2} ${-padding} 
        A ${radius} ${radius} 0 0 1 ${GRID_SIZE * 2} ${h + padding} 
        L 0 ${h + padding} 
        L 0 ${-padding} 
        Z
        M ${GRID_SIZE * 5} ${centerY}
        A 5 5 0 1 1 ${GRID_SIZE * 4} ${centerY}
        A 5 5 0 1 1 ${GRID_SIZE * 5} ${centerY}
      `
    },
    outputOffset: -GRID_SIZE * 2 // Move output to 5 grid units (75px) to align with grid vertex
  },

  nor: {
    label: 'NOR Gate',
    logicClass: 'Nor',
    pythonModule: 'logic',
    // SVG path generator for NOR gate shape (MIL-STD-806B)
    getSvgPath: (h, padding) => {
      // Fixed-size NOR gate: OR gate shape with negation circle at output
      // Width: 4 grid units (60px) for OR shape + 1 grid unit (15px) for negation circle = 75px total
      const centerY = h / 2
      return `
        M 0 ${-padding}
        Q 12 ${-padding}, 12 ${-padding}
        Q ${GRID_SIZE * 3} ${centerY - GRID_SIZE}, ${GRID_SIZE * 4} ${centerY}
        Q ${GRID_SIZE * 3} ${centerY + GRID_SIZE}, 12 ${h + padding}
        Q 12 ${h + padding}, 0 ${h + padding}
        Q 10 ${centerY}, 0 ${-padding}
        Z
        M ${GRID_SIZE * 5} ${centerY}
        A 5 5 0 1 1 ${GRID_SIZE * 4} ${centerY}
        A 5 5 0 1 1 ${GRID_SIZE * 5} ${centerY}
      `
    },
    outputOffset: -GRID_SIZE * 2 // Move output to 5 grid units (75px) to align with right edge of negation circle
  }
}

// Helper function to get a gate definition
export function getGateDefinition(gateType) {
  return gateDefinitions[gateType] || null
}

// Helper function to generate Python code for a gate
export function generateGateCode(gateType, varName, props) {
  const definition = gateDefinitions[gateType]
  if (!definition) return null

  const params = []

  // Add num_inputs parameter if not default
  if (props.numInputs && props.numInputs !== 2) {
    params.push(`num_inputs=${props.numInputs}`)
  }

  // Add bits parameter if specified and not default
  if (props.bits && props.bits !== 1) {
    params.push(`bits=${props.bits}`)
  }

  // Add inverted_inputs parameter if specified and not empty
  if (props.invertedInputs && props.invertedInputs.length > 0) {
    params.push(`inverted_inputs=[${props.invertedInputs.join(', ')}]`)
  }

  // Add label parameter if specified
  if (props.label && props.label !== definition.label) {
    params.push(`label="${props.label}"`)
  }

  const paramsStr = params.length > 0 ? params.join(', ') : ''
  return `${varName} = ${definition.pythonModule}.${definition.logicClass}(${paramsStr})`
}
