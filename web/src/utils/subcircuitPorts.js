import { PORT_PITCH } from './constants'

/**
 * Geometry for a subcircuit rendered as a component box: the grid-unit size of the box and the
 * connection point of every input/output port. Shared by componentRegistry.getConnections (which
 * serializes these coordinates) and SchematicComponent (which renders them), so the two can never
 * drift — a wire endpoint always lands exactly on the port it targets.
 *
 * Ports sit on the box edge their rotation points them at. Ports on a VERTICAL edge (left/right)
 * spread top-to-bottom; ports on a HORIZONTAL edge (top/bottom) spread left-to-right. Previously
 * every rotated (top/bottom) port was pinned to the edge's center, so two of them collapsed onto a
 * single vertex — this lays them out on their own grid vertices instead.
 *
 * To stay byte-compatible with existing circuits (whose rotated ports are always alone on an edge),
 * the vertical spread is unchanged: it uses the port's ROLE index and centers a port when its role
 * has exactly one — so a lone output stays centered on the right edge, never shifting a saved wire.
 * Only a HORIZONTAL edge with more than one port changes behavior.
 *
 * @param {Array<{rotation?: number}>} inputs  input ports, in display order
 * @param {Array<{rotation?: number}>} outputs output ports, in display order
 * @param {{forcedWidth?: number}} [opts] forcedWidth overrides the default 6-grid-unit width
 * @returns {{ width: number, height: number,
 *             inputPoints: Array<{x:number,y:number}>, outputPoints: Array<{x:number,y:number}> }}
 */
export function computeSubcircuitLayout(inputs, outputs, { forcedWidth = 0 } = {}) {
  const inCount = inputs.length
  const outCount = outputs.length
  // Height is driven by the port count (unchanged formula), so the box and its centered ports keep
  // their exact positions for every circuit that predates edge-aware layout.
  const height = Math.max(4, (Math.max(inCount, outCount, 1) - 1) * PORT_PITCH + 2)

  // Number the ports that share a horizontal edge (across both roles) so they spread left-to-right.
  const tagged = [
    ...inputs.map((p, i) => ({ isInput: true, i, edge: portEdge(true, p.rotation) })),
    ...outputs.map((p, i) => ({ isInput: false, i, edge: portEdge(false, p.rotation) }))
  ]
  const horiz = new Map() // `${isInput}:${i}` -> { idx, count } within its top/bottom edge
  for (const e of ['top', 'bottom']) {
    const members = tagged.filter(t => t.edge === e)
    members.forEach((t, idx) => horiz.set(`${t.isInput}:${t.i}`, { idx, count: members.length }))
  }
  const hMax = Math.max(
    tagged.filter(t => t.edge === 'top').length,
    tagged.filter(t => t.edge === 'bottom').length
  )
  const base = forcedWidth > 0 ? forcedWidth : 6
  // Only widen past the default when a horizontal edge genuinely needs the room (>1 port); a single
  // top/bottom port (every existing circuit) leaves the width — and thus the right-edge outputs —
  // untouched.
  const width = Math.max(base, hMax > 1 ? (hMax - 1) * PORT_PITCH + 2 : 0)

  // One port on an edge → centered on it; several → 1-unit margin then PORT_PITCH apart.
  const along = (count, i, span) => Math.round(count === 1 ? span / 2 : 1 + i * PORT_PITCH)

  const point = (isInput, i, rotation) => {
    const edge = portEdge(isInput, rotation)
    if (edge === 'left') return { x: 0, y: along(isInput ? inCount : outCount, i, height) }
    if (edge === 'right') return { x: width, y: along(isInput ? inCount : outCount, i, height) }
    const h = horiz.get(`${isInput}:${i}`)
    return { x: along(h.count, h.idx, width), y: edge === 'top' ? 0 : height }
  }

  return {
    width,
    height,
    inputPoints: inputs.map((p, i) => point(true, i, p.rotation)),
    outputPoints: outputs.map((p, i) => point(false, i, p.rotation))
  }
}

// Which box edge a port lands on, given its role and rotation. Matches the rotation remapping that
// has always lived in getConnections / SchematicComponent. Exported so the renderer can orient each
// port's label to its edge without re-deriving the mapping.
export function portEdge(isInput, rotation) {
  const r = (((rotation || 0) % 360) + 360) % 360
  if (isInput) return r === 90 ? 'top' : r === 180 ? 'right' : r === 270 ? 'bottom' : 'left'
  return r === 90 ? 'bottom' : r === 180 ? 'left' : r === 270 ? 'top' : 'right'
}
