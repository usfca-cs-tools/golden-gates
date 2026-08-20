import { describe, it, expect } from 'vitest'
import { componentRegistry } from '@/utils/componentRegistry'
import { PORT_PITCH } from '@/utils/constants'

// Subcircuits and plexers pack their I/O ports at PORT_PITCH grid units so circuits stay compact
// on small screens. These pin the pitch (in grid units) at the wiring source of truth
// (getConnections), and that every port lands on an integer vertex — a fractional port is
// unreachable by the integer-only wire snap. Plexer rotation invariants live in rotation.test.js.

describe('subcircuit port pitch', () => {
  it('PORT_PITCH is 1 (compact layout)', () => {
    expect(PORT_PITCH).toBe(1)
  })

  // A subcircuit instance derives its ports from the child circuit's input/output components.
  const childCircuit = {
    components: [
      { id: 'i0', type: 'input', props: { label: 'A' } },
      { id: 'i1', type: 'input', props: { label: 'B' } },
      { id: 'i2', type: 'input', props: { label: 'C' } },
      { id: 'i3', type: 'input', props: { label: 'D' } },
      { id: 'o0', type: 'output', props: { label: 'X' } },
      { id: 'o1', type: 'output', props: { label: 'Y' } }
    ]
  }
  const circuitManager = { getCircuit: () => childCircuit }
  const sub = componentRegistry['schematic-component']

  it('spreads each edge evenly and centered over the box height', () => {
    const { inputs, outputs } = sub.getConnections({ circuitId: 'child' }, circuitManager)
    // 4 inputs pack the left edge at PORT_PITCH (height is sized to them: (4-1)+2 = 5)
    expect(inputs.map(p => p.y)).toEqual([1, 2, 3, 4])
    // 2 outputs spread to fill that same height rather than clustering at the top
    expect(outputs.map(p => p.y)).toEqual([1, 4])
    // inputs on the left edge, outputs on the right (6-wide body)
    expect(inputs.every(p => p.x === 0)).toBe(true)
    expect(outputs.every(p => p.x === 6)).toBe(true)
  })

  it('keeps every port on an integer grid vertex', () => {
    const { inputs, outputs } = sub.getConnections({ circuitId: 'child' }, circuitManager)
    for (const p of [...inputs, ...outputs]) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
    }
  })
})

describe('plexer data-port pitch is PORT_PITCH', () => {
  it('multiplexer inputs are one grid unit apart', () => {
    const { inputs } = componentRegistry['multiplexer'].getConnections({ selectorBits: 2 })
    // first two data inputs (index 0,1) — sel is appended last
    expect(inputs[1].y - inputs[0].y).toBe(PORT_PITCH)
  })

  it('decoder outputs are one grid unit apart', () => {
    const { outputs } = componentRegistry['decoder'].getConnections({ selectorBits: 2 })
    expect(outputs[1].y - outputs[0].y).toBe(PORT_PITCH)
  })

  it('priority-encoder inputs are one grid unit apart', () => {
    const { inputs } = componentRegistry['priorityEncoder'].getConnections({ selectorBits: 2 })
    expect(inputs[1].y - inputs[0].y).toBe(PORT_PITCH)
  })
})
