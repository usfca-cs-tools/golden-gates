import { computeComponentPorts } from './portGeometry'

/**
 * Auto-connect suggestions (issue #70): after a component is placed or moved,
 * propose wires between its ports and nearby ports that face it.
 *
 * A pair qualifies when one port is an output and the other an input, they face
 * opposite directions, each lies strictly in front of the other, they are within
 * `maxDistance` grid units (Manhattan), the input has no wire yet, and their bit
 * widths match (an unknown width matches anything). Each input gets at most one
 * proposal: its nearest output, preferring a straight wire, then the lower y.
 */

export const AUTO_CONNECT_MAX_DISTANCE = 4

// Clockwise in screen space (y down), matching componentFactory.rotatePoint.
const FACINGS = ['east', 'south', 'west', 'north']

const FACING_VECTORS = {
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  north: { x: 0, y: -1 }
}

/**
 * @param {'east'|'south'|'west'|'north'} facing
 * @param {number} [rotation] - 0, 90, 180 or 270 degrees clockwise
 */
export function rotateFacing(facing, rotation = 0) {
  const steps = Math.round((rotation || 0) / 90)
  return FACINGS[(FACINGS.indexOf(facing) + steps) % 4]
}

/**
 * Inputs point west and outputs east before rotation, which holds for gates and
 * I/O nodes (whose SVGs rotate about their ports).
 *
 * @param {Object} component - circuit component ({ type, x, y, props })
 * @param {Object} port - a port from computeComponentPorts
 */
export function getPortFacing(component, port) {
  const base = port.direction === 'input' ? 'west' : 'east'
  return rotateFacing(base, component.props?.rotation)
}

/**
 * @param {Object} component - circuit component ({ type, x, y, props })
 * @returns {number|null} the port's bit width, or null when unknown
 */
export function getPortBits(component, port) {
  const bits = component.props?.bits
  return typeof bits === 'number' ? bits : null
}

function absolutePorts(component, circuitManager) {
  return computeComponentPorts(component, circuitManager).map(port => ({
    component,
    port,
    pos: { x: component.x + port.x, y: component.y + port.y },
    facing: getPortFacing(component, port),
    bits: getPortBits(component, port)
  }))
}

function posKey(pos) {
  return `${pos.x},${pos.y}`
}

function isOpposed(a, b) {
  return FACINGS.indexOf(a.facing) === (FACINGS.indexOf(b.facing) + 2) % 4
}

function isInFront(from, to) {
  const v = FACING_VECTORS[from.facing]
  return (to.pos.x - from.pos.x) * v.x + (to.pos.y - from.pos.y) * v.y > 0
}

function bitsCompatible(a, b) {
  return a.bits === null || b.bits === null || a.bits === b.bits
}

function manhattan(a, b) {
  return Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.y - b.pos.y)
}

function isStraight(a, b) {
  return a.pos.x === b.pos.x || a.pos.y === b.pos.y
}

// Lower is better: distance, then straight before bent, then lower y.
function compareCandidates(a, b) {
  return a.distance - b.distance || a.bent - b.bent || a.y - b.y
}

/**
 * @param {string} componentId - the component that was just placed or moved
 * @param {Object} options
 * @param {Array} options.components - all components in the circuit
 * @param {Array} [options.wires] - all wires in the circuit
 * @param {Object} [options.circuitManager] - needed only for schematic-component ports
 * @param {number} [options.maxDistance]
 * @returns {Array<{outputComponentId: string, outputPort: string, inputComponentId: string,
 *   inputPort: string, start: {x: number, y: number}, end: {x: number, y: number}}>}
 */
export function findAutoConnectSuggestions(
  componentId,
  { components, wires = [], circuitManager = null, maxDistance = AUTO_CONNECT_MAX_DISTANCE }
) {
  if (!components.some(c => c.id === componentId)) return []

  const ports = components.flatMap(c => absolutePorts(c, circuitManager))
  const wiredInputs = new Set(wires.map(w => posKey(w.endConnection.pos)))
  const inputs = ports.filter(p => p.port.direction === 'input' && !wiredInputs.has(posKey(p.pos)))
  const outputs = ports.filter(p => p.port.direction === 'output')

  const suggestions = []
  for (const input of inputs) {
    const candidates = outputs
      .filter(
        output =>
          output.component !== input.component &&
          (output.component.id === componentId || input.component.id === componentId) &&
          isOpposed(input, output) &&
          isInFront(input, output) &&
          isInFront(output, input) &&
          bitsCompatible(input, output) &&
          manhattan(input, output) <= maxDistance
      )
      .map(output => ({
        output,
        distance: manhattan(input, output),
        bent: isStraight(input, output) ? 0 : 1,
        y: output.pos.y
      }))
      .sort(compareCandidates)

    if (candidates.length === 0) continue
    const { output } = candidates[0]
    suggestions.push({
      outputComponentId: output.component.id,
      outputPort: output.port.name,
      inputComponentId: input.component.id,
      inputPort: input.port.name,
      start: output.pos,
      end: input.pos
    })
  }
  return suggestions
}
