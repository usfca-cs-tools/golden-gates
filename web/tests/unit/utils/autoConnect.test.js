import { describe, it, expect } from 'vitest'
import {
  AUTO_CONNECT_MAX_DISTANCE,
  rotateFacing,
  getPortFacing,
  getPortBits,
  findAutoConnectSuggestions
} from '@/utils/autoConnect'
import { computeComponentPorts } from '@/utils/portGeometry'
import { componentRegistry } from '@/utils/componentRegistry'

// Auto-connect suggestions (issue #70): after a component is placed or moved, propose
// wires between its ports and nearby ports that face it. These pin the matching rules
// agreed on the issue — opposed facing, each port in front of the other, Manhattan
// distance <= 4, free inputs only, matching bit widths, best output per input.

function make(type, id, x, y, props = {}) {
  return { id, type, x, y, props: { ...componentRegistry[type].defaultProps, ...props } }
}

// Absolute grid position of a component's port, from the same source wires use.
function portPos(component, direction, name = '0') {
  const port = computeComponentPorts(component).find(
    p => p.direction === direction && p.name === name
  )
  return { x: component.x + port.x, y: component.y + port.y }
}

function portOf(component, direction, name = '0') {
  return computeComponentPorts(component).find(p => p.direction === direction && p.name === name)
}

// An Input node whose output port sits `dx` left of and `dy` below `target`.
function inputFacing(id, target, dx, dy = 0, props = {}) {
  const offset = portOf(make('input', id, 0, 0, props), 'output')
  return make('input', id, target.x - dx - offset.x, target.y + dy - offset.y, props)
}

function wire(id, start, end) {
  return {
    id,
    points: [start, end],
    startConnection: { pos: start, portType: 'output' },
    endConnection: { pos: end, portType: 'input' }
  }
}

function suggest(componentId, components, wires = [], options = {}) {
  return findAutoConnectSuggestions(componentId, { components, wires, ...options })
}

describe('AUTO_CONNECT_MAX_DISTANCE', () => {
  it('is 4 grid units', () => {
    expect(AUTO_CONNECT_MAX_DISTANCE).toBe(4)
  })
})

describe('rotateFacing', () => {
  it('rotates clockwise in screen space, matching rotatePoint', () => {
    expect(rotateFacing('east', 90)).toBe('south')
    expect(rotateFacing('south', 90)).toBe('west')
    expect(rotateFacing('west', 90)).toBe('north')
    expect(rotateFacing('north', 90)).toBe('east')
  })

  it('handles 0, 180 and 270', () => {
    expect(rotateFacing('west', 0)).toBe('west')
    expect(rotateFacing('west', 180)).toBe('east')
    expect(rotateFacing('west', 270)).toBe('south')
  })

  it('treats a missing rotation as 0', () => {
    expect(rotateFacing('east', undefined)).toBe('east')
  })
})

describe('getPortFacing', () => {
  it('faces gate inputs west and the gate output east at rotation 0', () => {
    const gate = make('and-gate', 'g', 0, 0)
    expect(getPortFacing(gate, portOf(gate, 'input', '0'))).toBe('west')
    expect(getPortFacing(gate, portOf(gate, 'input', '1'))).toBe('west')
    expect(getPortFacing(gate, portOf(gate, 'output'))).toBe('east')
  })

  it('rotates gate port facings with the gate', () => {
    const gate = make('and-gate', 'g', 0, 0, { rotation: 90 })
    expect(getPortFacing(gate, portOf(gate, 'input', '0'))).toBe('north')
    expect(getPortFacing(gate, portOf(gate, 'output'))).toBe('south')
  })

  it('faces an Input node port east and an Output node port west', () => {
    const input = make('input', 'i', 0, 0)
    const output = make('output', 'o', 0, 0)
    expect(getPortFacing(input, portOf(input, 'output'))).toBe('east')
    expect(getPortFacing(output, portOf(output, 'input'))).toBe('west')
  })

  it('rotates I/O node facings', () => {
    const input = make('input', 'i', 0, 0, { rotation: 180 })
    const output = make('output', 'o', 0, 0, { rotation: 90 })
    expect(getPortFacing(input, portOf(input, 'output'))).toBe('west')
    expect(getPortFacing(output, portOf(output, 'input'))).toBe('north')
  })
})

describe('getPortBits', () => {
  it('reads the component bit width', () => {
    const gate = make('and-gate', 'g', 0, 0)
    const bus = make('input', 'i', 0, 0, { bits: 8 })
    expect(getPortBits(gate, portOf(gate, 'input', '0'))).toBe(1)
    expect(getPortBits(bus, portOf(bus, 'output'))).toBe(8)
  })

  it('returns null when the width is unknown', () => {
    const input = make('input', 'i', 0, 0, { bits: undefined })
    expect(getPortBits(input, portOf(input, 'output'))).toBeNull()
  })
})

describe('findAutoConnectSuggestions', () => {
  const gate = make('and-gate', 'g', 10, 10)
  const in0 = portPos(gate, 'input', '0')
  const in1 = portPos(gate, 'input', '1')
  const out = portPos(gate, 'output')

  describe('basic matching', () => {
    it('suggests a wire from a placed Input node to the gate input it faces', () => {
      const a = inputFacing('a', in0, 3)
      const result = suggest('a', [gate, a])
      expect(result).toEqual([
        {
          outputComponentId: 'a',
          outputPort: '0',
          inputComponentId: 'g',
          inputPort: '0',
          start: portPos(a, 'output'),
          end: in0
        }
      ])
    })

    it('suggests a wire from the gate output to a placed Output node it faces', () => {
      const r = make('output', 'r', out.x + 3, out.y)
      const result = suggest('r', [gate, r])
      expect(result).toEqual([
        expect.objectContaining({
          outputComponentId: 'g',
          outputPort: '0',
          inputComponentId: 'r',
          inputPort: '0',
          start: out,
          end: { x: out.x + 3, y: out.y }
        })
      ])
    })

    it('works in reverse: a gate placed next to an existing Input node', () => {
      const a = inputFacing('a', in0, 3)
      const result = suggest('g', [a, gate])
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ outputComponentId: 'a', inputComponentId: 'g' })
    })

    it('only proposes pairs that involve the placed component', () => {
      // a faces g's input, but r (the placed part) faces nothing
      const a = inputFacing('a', in0, 2)
      const r = make('output', 'r', out.x + 20, out.y)
      expect(suggest('r', [gate, a, r])).toEqual([])
    })

    it('returns [] for an unknown component id', () => {
      expect(suggest('missing', [gate])).toEqual([])
    })
  })

  describe('distance', () => {
    it('accepts exactly the maximum distance', () => {
      const a = inputFacing('a', in0, 4)
      expect(suggest('a', [gate, a])).toHaveLength(1)
    })

    it('rejects one unit past the maximum distance', () => {
      const a = inputFacing('a', in0, 5)
      expect(suggest('a', [gate, a])).toEqual([])
    })

    it('measures Manhattan distance, so a vertical offset counts', () => {
      // above in0, so the nearer in1 doesn't interfere
      expect(suggest('a', [gate, inputFacing('a', in0, 2, -2)])).toHaveLength(1) // 2 + 2 = 4
      expect(suggest('a', [gate, inputFacing('a', in0, 3, -2)])).toEqual([]) // 3 + 2 = 5
    })

    it('honours a maxDistance override', () => {
      const a = inputFacing('a', in0, 6)
      expect(suggest('a', [gate, a], [], { maxDistance: 6 })).toHaveLength(1)
    })
  })

  describe('facing', () => {
    it('rejects ports that point the same way', () => {
      // west-facing Input node to the left of a west-facing gate input
      const a = inputFacing('a', in0, 3, 0, { rotation: 180 })
      expect(suggest('a', [gate, a])).toEqual([])
    })

    it('rejects perpendicular ports', () => {
      const a = inputFacing('a', in0, 3, 0, { rotation: 90 })
      expect(suggest('a', [gate, a])).toEqual([])
    })

    it('rejects opposed ports that are behind each other', () => {
      // east-facing Input node port to the right of the west-facing gate input
      const a = inputFacing('a', in0, -2)
      expect(suggest('a', [gate, a])).toEqual([])
    })

    it('rejects coincident ports, which are not strictly in front', () => {
      const a = inputFacing('a', in0, 0)
      expect(suggest('a', [gate, a])).toEqual([])
    })

    it('matches vertically when both parts are rotated', () => {
      const rotated = make('and-gate', 'g', 10, 10, { rotation: 90 })
      const target = portPos(rotated, 'input', '0') // faces north
      const offset = portOf(make('input', 'a', 0, 0, { rotation: 90 }), 'output')
      const a = make('input', 'a', target.x - offset.x, target.y - 3 - offset.y, { rotation: 90 })
      expect(suggest('a', [rotated, a])).toHaveLength(1)
    })
  })

  describe('bit widths', () => {
    it('skips ports whose widths differ', () => {
      const a = inputFacing('a', in0, 3, 0, { bits: 8 })
      expect(suggest('a', [gate, a])).toEqual([])
    })

    it('matches equal multi-bit widths', () => {
      const wide = make('and-gate', 'g', 10, 10, { bits: 8 })
      const a = inputFacing('a', portPos(wide, 'input', '0'), 3, 0, { bits: 8 })
      expect(suggest('a', [wide, a])).toHaveLength(1)
    })

    it('treats an unknown width as a wildcard', () => {
      const a = inputFacing('a', in0, 3, 0, { bits: undefined })
      expect(suggest('a', [gate, a])).toHaveLength(1)
    })
  })

  describe('existing wires', () => {
    it('skips an input that already has a wire', () => {
      const a = inputFacing('a', in0, 3)
      const existing = wire('w1', { x: in0.x - 10, y: in0.y }, in0)
      expect(suggest('a', [gate, a], [existing])).toEqual([])
    })

    it('still suggests other free inputs on the same gate', () => {
      const a = inputFacing('a', in0, 3)
      const b = inputFacing('b', in1, 3)
      const existing = wire('w1', { x: in0.x - 10, y: in0.y }, in0)
      const result = suggest('g', [gate, a, b], [existing])
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ outputComponentId: 'b', inputPort: '1' })
    })

    it('keeps an output eligible when it already drives a wire (fan-out)', () => {
      const a = inputFacing('a', in0, 3)
      const existing = wire('w1', portPos(a, 'output'), { x: 0, y: 0 })
      expect(suggest('a', [gate, a], [existing])).toHaveLength(1)
    })
  })

  describe('choosing between candidates', () => {
    it('proposes every free input in one batch', () => {
      const a = inputFacing('a', in0, 3)
      const b = inputFacing('b', in1, 3)
      const result = suggest('g', [gate, a, b])
      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ outputComponentId: 'a', inputPort: '0' }),
          expect.objectContaining({ outputComponentId: 'b', inputPort: '1' })
        ])
      )
    })

    it('gives each input at most one proposal, from the nearest output', () => {
      const near = inputFacing('near', in0, 2)
      const far = inputFacing('far', in0, 4)
      const result = suggest('g', [gate, near, far])
      const forIn0 = result.filter(s => s.inputPort === '0')
      expect(forIn0).toEqual([expect.objectContaining({ outputComponentId: 'near' })])
    })

    it('breaks distance ties in favour of a straight wire', () => {
      const straight = inputFacing('straight', in0, 3)
      const bent = inputFacing('bent', in0, 2, -1)
      const result = suggest('g', [gate, straight, bent]).filter(s => s.inputPort === '0')
      expect(result).toEqual([expect.objectContaining({ outputComponentId: 'straight' })])
    })

    it('then breaks ties in favour of the lower y', () => {
      // two equally distant bent candidates for in0, one above and one below
      const above = inputFacing('above', in0, 2, -1)
      const below = inputFacing('below', in0, 2, 1)
      const result = suggest('g', [gate, above, below]).filter(s => s.inputPort === '0')
      expect(result).toEqual([expect.objectContaining({ outputComponentId: 'above' })])
    })

    it('lets one output feed several inputs', () => {
      // midway between in0 and in1, one unit from each row
      const mid = inputFacing('mid', in0, 2, (in1.y - in0.y) / 2)
      const result = suggest('mid', [gate, mid])
      expect(result.map(s => s.inputPort).sort()).toEqual(['0', '1'])
      expect(result.every(s => s.outputComponentId === 'mid')).toBe(true)
    })
  })
})
