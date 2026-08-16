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
 * @param {{forcedWidth?: number, forcedHeight?: number}} [opts] manual width/height overrides
 *   (grid units); forcedWidth carries the right-edge outputs, forcedHeight carries the bottom edge.
 * @returns {{ width: number, height: number,
 *             inputPoints: Array<{x:number,y:number}>, outputPoints: Array<{x:number,y:number}> }}
 */
export function computeSubcircuitLayout(
  inputs,
  outputs,
  { forcedWidth = 0, forcedHeight = 0 } = {}
) {
  const inCount = inputs.length
  const outCount = outputs.length
  // The span the LEFT/RIGHT ports lay out against — driven by port count, never the manual height,
  // so side ports keep their positions when the frame is resized (a uniform-height register stays
  // wired). The FRAME (and the bottom edge) can grow past it via a manual height.
  const portSpan = Math.max(4, (Math.max(inCount, outCount, 1) - 1) * PORT_PITCH + 2)
  // Box height = the port span, grown to the manual height when that's larger. Bottom-edge ports
  // track this (they sit ON the bottom edge), so raising the height moves them down with the frame
  // — the top/bottom labels then have room and stop overprinting.
  const height = Math.max(portSpan, forcedHeight || 0)

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
    // Side ports spread over the port span (stay put on resize); top is the top edge, bottom is the
    // frame's bottom edge (tracks a manual height).
    if (edge === 'left') return { x: 0, y: along(isInput ? inCount : outCount, i, portSpan) }
    if (edge === 'right') return { x: width, y: along(isInput ? inCount : outCount, i, portSpan) }
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
