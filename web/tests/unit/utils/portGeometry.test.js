import { describe, it, expect } from 'vitest'
import { computeComponentPorts } from '@/utils/portGeometry'
import { componentRegistry } from '@/utils/componentRegistry'
import { useFileService } from '@/composables/useFileService'

// The whole point of storing port coordinates is that they equal the coordinate
// a wire endpoint gets when drawn to that port. Both derive from the registry's
// getConnections/connections (see useWireController.startWireDrawing), so these
// tests pin that shared source and the serialization that carries it.

describe('computeComponentPorts', () => {
  it('returns the input component output port as a named, directed offset', () => {
    const ports = computeComponentPorts({ type: 'input', x: 5, y: 5, props: { bits: 1 } })
    expect(ports).toContainEqual(
      expect.objectContaining({ name: '0', direction: 'output' })
    )
    expect(ports.every(p => typeof p.x === 'number' && typeof p.y === 'number')).toBe(true)
  })

  it('names an AND gate two inputs and one output', () => {
    const ports = computeComponentPorts({
      type: 'and-gate',
      x: 0,
      y: 0,
      props: { ...componentRegistry['and-gate'].defaultProps }
    })
    const inputs = ports.filter(p => p.direction === 'input')
    const outputs = ports.filter(p => p.direction === 'output')
    expect(inputs.map(p => p.name)).toEqual(['0', '1'])
    expect(outputs.map(p => p.name)).toEqual(['0'])
  })

  it('offsets equal the registry source wire endpoints use, for every static/dynamic type', () => {
    for (const [type, config] of Object.entries(componentRegistry)) {
      // schematic-component needs a circuitManager/definition; covered separately.
      if (type === 'schematic-component' || !config) continue
      const props = config.defaultProps || {}
      const raw = config.getConnections ? config.getConnections(props) : config.connections
      if (!raw) continue

      const ports = computeComponentPorts({ type, x: 0, y: 0, props })
      const rawOffsets = [
        ...(raw.inputs || []).map(p => `in:${p.x},${p.y}`),
        ...(raw.outputs || []).map(p => `out:${p.x},${p.y}`)
      ].sort()
      const gotOffsets = ports
        .map(p => `${p.direction === 'input' ? 'in' : 'out'}:${p.x},${p.y}`)
        .sort()
      expect(gotOffsets, `type ${type}`).toEqual(rawOffsets)
    }
  })

  it('returns [] for an unknown type instead of throwing', () => {
    expect(computeComponentPorts({ type: 'nonexistent', x: 0, y: 0, props: {} })).toEqual([])
  })

  // The project (multi-file) save strips the in-memory circuitId and persists a subcircuit
  // reference by filename only. Port geometry must still resolve, or every serialized subcircuit
  // port collapses to the 1-in/1-out default and misses its wires (a whole class of grading bugs).
  describe('schematic-component resolves by filename when circuitId is absent', () => {
    const sub = {
      components: [
        { id: 'a', type: 'input', x: 0, y: 0, props: { label: 'A', bits: 8 } },
        { id: 'b', type: 'input', x: 0, y: 4, props: { label: 'B', bits: 8 } },
        { id: 's', type: 'output', x: 10, y: 0, props: { label: 'S', bits: 8 } },
        { id: 'c', type: 'output', x: 10, y: 4, props: { label: 'COUT', bits: 1 } }
      ]
    }
    const cm = {
      getCircuit: id => (id === 'cid_adder' ? sub : null),
      getCircuitByFilename: fn => (fn === 'adder-8-bit.ggc' ? sub : null)
    }

    it('produces the full multi-port layout, identical to resolving by circuitId', () => {
      const byFilename = computeComponentPorts(
        { type: 'schematic-component', x: 0, y: 0, props: { filename: 'adder-8-bit.ggc' } },
        cm
      )
      const byCircuitId = computeComponentPorts(
        { type: 'schematic-component', x: 0, y: 0, props: { circuitId: 'cid_adder' } },
        cm
      )
      // Not the collapsed default:
      expect(byFilename.filter(p => p.direction === 'input')).toHaveLength(2)
      expect(byFilename.filter(p => p.direction === 'output')).toHaveLength(2)
      // Named by index (ggl.view maps positional port -> inner label by order):
      expect(byFilename.filter(p => p.direction === 'input').map(p => p.name)).toEqual(['0', '1'])
      // filename path == circuitId path:
      expect(byFilename).toEqual(byCircuitId)
    })

    it('still falls back to the 1-in/1-out default when neither resolves', () => {
      const ports = computeComponentPorts(
        { type: 'schematic-component', x: 0, y: 0, props: { filename: 'missing.ggc' } },
        cm
      )
      expect(ports.filter(p => p.direction === 'input')).toHaveLength(1)
      expect(ports.filter(p => p.direction === 'output')).toHaveLength(1)
    })
  })
})

describe('buildCircuitData port serialization', () => {
  const { buildCircuitData } = useFileService()

  it('attaches ports to each component and writes version 1.4', () => {
    const data = buildCircuitData(
      [
        { id: 'a', type: 'input', x: 2, y: 3, props: { bits: 1 } },
        { id: 'b', type: 'and-gate', x: 8, y: 3, props: { ...componentRegistry['and-gate'].defaultProps } }
      ],
      [],
      []
    )
    expect(data.version).toBe('1.5')
    expect(Array.isArray(data.components[0].ports)).toBe(true)
    expect(data.components[0].ports).toContainEqual(
      expect.objectContaining({ name: '0', direction: 'output' })
    )
    expect(data.components[1].ports.filter(p => p.direction === 'input')).toHaveLength(2)
  })

  it('a wire endpoint matches (component.x + port offset) of the port it targets', () => {
    // input "a" output port; the wire to it should sit at a.x + offset, a.y + offset.
    const a = { id: 'a', type: 'input', x: 4, y: 7, props: { bits: 1 } }
    const ports = computeComponentPorts(a)
    const out = ports.find(p => p.direction === 'output')
    const abs = { x: a.x + out.x, y: a.y + out.y }
    // This is exactly what startWireDrawing stores as startConnection.pos.
    expect(abs).toEqual({ x: a.x + out.x, y: a.y + out.y })
    // and it survives serialization as a relative offset alongside the position.
    const data = buildCircuitData([a], [], [])
    const serialized = data.components[0].ports.find(p => p.direction === 'output')
    expect({ x: data.components[0].x + serialized.x, y: data.components[0].y + serialized.y }).toEqual(abs)
  })

  it('attaches ports to nested schematic-circuit components too', () => {
    const data = buildCircuitData(
      [{ id: 'top', type: 'output', x: 0, y: 0, props: { bits: 1 } }],
      [],
      [],
      {},
      {
        circuit_2: {
          definition: { id: 'circuit_2' },
          circuit: {
            components: [{ id: 'n', type: 'and-gate', x: 1, y: 1, props: { ...componentRegistry['and-gate'].defaultProps } }],
            wires: []
          }
        }
      }
    )
    const nested = data.schematicComponents.circuit_2.circuit.components[0]
    expect(Array.isArray(nested.ports)).toBe(true)
    expect(nested.ports.length).toBeGreaterThan(0)
  })
})
