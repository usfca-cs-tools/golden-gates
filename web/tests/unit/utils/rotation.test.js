import { describe, it, expect } from 'vitest'
import { rotateConnections } from '@/utils/componentFactory'
import { componentRegistry } from '@/utils/componentRegistry'

// Rotation-aware getConnections: a rotated component's ports must resolve to where
// the SFC actually draws the dot, and must stay on integer grid vertices (exact-match
// wire resolution depends on it). These pin the shared helper and the mux, the first
// multi-port component migrated to it.

describe('rotateConnections', () => {
  const conns = {
    inputs: [{ name: '0', x: 0, y: 1 }],
    outputs: [{ name: '0', x: 2, y: 1 }]
  }

  it('is identity at rotation 0', () => {
    expect(rotateConnections(conns, 0, { x: 2, y: 1 })).toEqual(conns)
  })

  it('leaves the rotation center fixed', () => {
    for (const r of [90, 180, 270]) {
      const out = rotateConnections(conns, r, { x: 2, y: 1 }).outputs[0]
      expect({ x: out.x, y: out.y }).toEqual({ x: 2, y: 1 }) // center == output
    }
  })

  it('rotates a port 90° clockwise around the center and preserves name', () => {
    const rotated = rotateConnections(conns, 90, { x: 2, y: 1 })
    // input (0,1) about (2,1): translated (-2,0) -> 90 -> (0,-2) -> (2,-1)
    expect(rotated.inputs[0]).toMatchObject({ name: '0', x: 2, y: -1 })
  })
})

describe('multiplexer getConnections under rotation', () => {
  const mux = componentRegistry['multiplexer']
  const base = { selectorBits: 2, selectorPosition: 'bottom' }

  const allPorts = conns => [...conns.inputs, ...conns.outputs]

  it('keeps every port on an integer grid vertex at each rotation', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const conns = mux.getConnections({ ...base, rotation })
      for (const p of allPorts(conns)) {
        expect(Number.isInteger(p.x), `x @${rotation} ${p.name}`).toBe(true)
        expect(Number.isInteger(p.y), `y @${rotation} ${p.name}`).toBe(true)
      }
    }
  })

  it('is unchanged at rotation 0', () => {
    const r0 = mux.getConnections({ ...base, rotation: 0 })
    // 4 data inputs + sel + 1 output
    expect(r0.inputs).toHaveLength(5)
    expect(r0.outputs).toHaveLength(1)
    expect(r0.outputs[0]).toMatchObject({ name: '0', x: 2, y: 4 })
    expect(r0.inputs[0]).toMatchObject({ name: '0', x: 0, y: 1 })
  })

  it('holds the output fixed and moves data inputs when rotated', () => {
    const r90 = mux.getConnections({ ...base, rotation: 90 })
    // output is the rotation center -> unmoved
    expect(r90.outputs[0]).toMatchObject({ name: '0', x: 2, y: 4 })
    // input "0" base (0,1) about center (2,4): translated (-2,-3) -> 90 -> (3,-2) -> (5,2)
    expect(r90.inputs[0]).toMatchObject({ name: '0', x: 5, y: 2 })
  })
})

describe('splitter/merger getConnections under rotation (origin center)', () => {
  const allPorts = c => [...(c.inputs || []), ...(c.outputs || [])]

  for (const type of ['splitter', 'merger']) {
    const cfg = componentRegistry[type]
    const base = { ...cfg.defaultProps }

    it(`${type}: every port stays on an integer grid vertex at each rotation`, () => {
      for (const rotation of [0, 90, 180, 270]) {
        const conns = cfg.getConnections({ ...base, rotation })
        for (const p of allPorts(conns)) {
          expect(Number.isInteger(p.x), `${type} x @${rotation} ${p.name}`).toBe(true)
          expect(Number.isInteger(p.y), `${type} y @${rotation} ${p.name}`).toBe(true)
        }
      }
    })

    it(`${type}: rotation 0 is unchanged and 90 rotates about the origin`, () => {
      const r0 = cfg.getConnections({ ...base, rotation: 0 })
      const r90 = cfg.getConnections({ ...base, rotation: 90 })
      // origin-centered 90deg: (x,y) -> (-y, x)
      const first0 = allPorts(r0)[0]
      const first90 = allPorts(r90)[0]
      expect(first90).toMatchObject({ x: -first0.y, y: first0.x })
    })
  }
})

describe('tunnel (single port) rotates about (1,1) and stays grid-aligned', () => {
  const tunnel = componentRegistry['tunnel']
  for (const direction of ['input', 'output']) {
    it(`${direction} tunnel: integer grid vertices at each rotation`, () => {
      for (const rotation of [0, 90, 180, 270]) {
        const c = tunnel.getConnections({ direction, rotation })
        for (const p of [...(c.inputs || []), ...(c.outputs || [])]) {
          expect(Number.isInteger(p.x) && Number.isInteger(p.y), `${direction} @${rotation}`).toBe(true)
        }
      }
    })
  }
})

describe('body-center rotated components stay grid-aligned', () => {
  const allPorts = c => [...(c.inputs || []), ...(c.outputs || [])]
  // Arithmetic (static ports wrapped) + register + decoder — all rotate about an
  // integer body center, so ports must remain on integer grid vertices at every angle.
  // priorityEncoder has an odd (3) width so it rotates about x=2, not its 1.5 center.
  const types = ['adder', 'subtract', 'multiply', 'divide', 'compare', 'shift', 'register', 'decoder', 'priorityEncoder']

  for (const type of types) {
    const cfg = componentRegistry[type]
    const base = { ...cfg.defaultProps }

    it(`${type}: every port is an integer grid vertex at 0/90/180/270`, () => {
      for (const rotation of [0, 90, 180, 270]) {
        for (const p of allPorts(cfg.getConnections({ ...base, rotation }))) {
          expect(Number.isInteger(p.x), `${type} x @${rotation} ${p.name}`).toBe(true)
          expect(Number.isInteger(p.y), `${type} y @${rotation} ${p.name}`).toBe(true)
        }
      }
    })

    it(`${type}: rotation 0 preserves port names`, () => {
      const names = allPorts(cfg.getConnections({ ...base, rotation: 0 })).map(p => p.name)
      const names180 = allPorts(cfg.getConnections({ ...base, rotation: 180 })).map(p => p.name)
      expect(names180.sort()).toEqual(names.sort())
    })
  }
})
