import { PORT_PITCH } from './constants'

// Grid units kept clear at each corner so ports never sit right on the frame edge.
const EDGE_MARGIN = 1

// Minimum spacing for top/bottom ports. Their labels read rotated (down into the box), so adjacent
// labels compete for horizontal room by their ~constant font thickness rather than the (compact)
// PORT_PITCH used for the left/right edges' horizontal labels. Two grid units keeps rotated labels
// like CLK / CLR / EN from over-printing each other.
const LABEL_PITCH = 2

// Grid units reserved at a horizontal edge that has more than one port, so the corner ports'
// rotated labels (which read into the box) don't cross the horizontal labels of the first/last
// left/right ports. Sized to clear a short control-signal name (CLK, EN, CLR); tune up if longer
// top/bottom labels are common.
const LABEL_BAND = 2

/**
 * Geometry for a subcircuit rendered as a component box: the grid-unit size of the box and the
 * connection point of every input/output port. Shared by componentRegistry.getConnections (which
 * serializes these coordinates) and SchematicComponent (which renders them), so the two can never
 * drift — a wire endpoint always lands exactly on the port it targets.
 *
 * Ports sit on the box edge their rotation points them at, and each edge's ports are spread EVENLY
 * and CENTERED over the box's span in that direction: left/right edges over the box HEIGHT,
 * top/bottom edges over the box WIDTH. A lone port sits at the center of its edge; several fill the
 * span with equal integer gaps and symmetric margins. This replaces the old top/left-anchored
 * packing, which left the ports clustered at the top of a manually-tall frame (e.g. a pipeline
 * register drawn tall to show stages) with the rest of the edge empty.
 *
 * Every point is snapped to an integer grid vertex — a fractional port is unreachable by the
 * integer-only wire snap.
 *
 * @param {Array<{rotation?: number}>} inputs  input ports, in display order
 * @param {Array<{rotation?: number}>} outputs output ports, in display order
 * @param {{forcedWidth?: number, forcedHeight?: number}} [opts] manual width/height overrides
 *   (grid units); the ports on each edge spread to fill the resulting box.
 * @returns {{ width: number, height: number,
 *             inputPoints: Array<{x:number,y:number}>, outputPoints: Array<{x:number,y:number}> }}
 */
export function computeSubcircuitLayout(
  inputs,
  outputs,
  { forcedWidth = 0, forcedHeight = 0 } = {}
) {
  // Tag every port with the edge its rotation lands it on, preserving per-role declaration order.
  const tagged = [
    ...inputs.map((p, i) => ({ isInput: true, i, edge: portEdge(true, p.rotation) })),
    ...outputs.map((p, i) => ({ isInput: false, i, edge: portEdge(false, p.rotation) }))
  ]
  const onEdge = e => tagged.filter(t => t.edge === e)
  const left = onEdge('left')
  const right = onEdge('right')
  const top = onEdge('top')
  const bottom = onEdge('bottom')

  // With more than one port on a horizontal edge, the outermost ones land in the corners, where
  // their rotated labels read down (top) or up (bottom) across the corner side-port's horizontal
  // label. Reserve a band at that edge and keep the left/right ports out of it, so the first/last
  // side port clears the corner label. A lone top/bottom port stays centered, far from the corners,
  // and needs no band — so small boxes (e.g. a 1-bit adder's centered CIN/COUT) are untouched.
  const topBand = top.length > 1 ? LABEL_BAND : 0
  const bottomBand = bottom.length > 1 ? LABEL_BAND : 0

  // The box must be tall enough for the busiest vertical edge (plus any reserved bands) and wide
  // enough for the busiest horizontal edge; a manual width or height grows it further, and the
  // ports then spread to fill the larger frame.
  const vCount = Math.max(left.length, right.length, 1)
  const hCount = Math.max(top.length, bottom.length, 1)
  const autoHeight = Math.max(
    4,
    (vCount - 1) * PORT_PITCH + 2 * EDGE_MARGIN + topBand + bottomBand
  )
  const autoWidth = Math.max(6, hCount > 1 ? (hCount - 1) * LABEL_PITCH + 2 * EDGE_MARGIN : 0)
  const height = Math.max(autoHeight, forcedHeight || 0)
  const width = Math.max(autoWidth, forcedWidth || 0)

  const coordFor = new Map() // `${isInput}:${i}` -> {x, y}
  const assign = (members, edge) => {
    const vertical = edge === 'left' || edge === 'right'
    if (vertical) {
      // Side ports fill the height between the reserved top/bottom label bands, at PORT_PITCH.
      const lo = topBand
      const pos = placeEvenly(members.length, height - topBand - bottomBand, PORT_PITCH)
      members.forEach((t, k) => {
        const y = pos[k] + lo
        coordFor.set(`${t.isInput}:${t.i}`, edge === 'left' ? { x: 0, y } : { x: width, y })
      })
      return
    }
    // Top/bottom labels read rotated and need the wider LABEL_PITCH so they don't over-print.
    const pos = placeEvenly(members.length, width, LABEL_PITCH)
    members.forEach((t, k) => {
      const x = pos[k]
      coordFor.set(`${t.isInput}:${t.i}`, edge === 'top' ? { x, y: 0 } : { x, y: height })
    })
  }
  assign(left, 'left')
  assign(right, 'right')
  assign(top, 'top')
  assign(bottom, 'bottom')

  return {
    width,
    height,
    inputPoints: inputs.map((_, i) => coordFor.get(`true:${i}`)),
    outputPoints: outputs.map((_, i) => coordFor.get(`false:${i}`))
  }
}

// Place `count` ports evenly and centered along an edge of `len` grid units, snapped to integer
// vertices. One port sits at the center; several share equal integer gaps (at least `minPitch`)
// with symmetric margins, filling as much of the edge as integer spacing allows.
function placeEvenly(count, len, minPitch = PORT_PITCH) {
  if (count <= 0) return []
  if (count === 1) return [Math.round(len / 2)]
  const pitch = Math.max(minPitch, Math.floor((len - 2 * EDGE_MARGIN) / (count - 1)))
  const span = pitch * (count - 1)
  const start = Math.round((len - span) / 2)
  return Array.from({ length: count }, (_, i) => start + i * pitch)
}

// Which box edge a port lands on, given its role and rotation. Matches the rotation remapping that
// has always lived in getConnections / SchematicComponent. Exported so the renderer can orient each
// port's label to its edge without re-deriving the mapping.
export function portEdge(isInput, rotation) {
  const r = (((rotation || 0) % 360) + 360) % 360
  if (isInput) return r === 90 ? 'top' : r === 180 ? 'right' : r === 270 ? 'bottom' : 'left'
  return r === 90 ? 'bottom' : r === 180 ? 'left' : r === 270 ? 'top' : 'right'
}
