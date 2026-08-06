// Orthogonal wire-routing geometry, shared by wire drawing (useWireController) and the
// connected-drag / move-and-stretch engine (useDragController). Pure functions on grid-unit
// points ({x,y}); no Vue, no side effects.

// A point lies on a segment if it is collinear (cross product ~0) and within the bounding box.
// Grid units, with epsilon for float drift during a drag.
export function pointOnSegment(a, b, p) {
  if (Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) > 1e-6) return false
  return (
    Math.min(a.x, b.x) - 1e-6 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-6 &&
    Math.min(a.y, b.y) - 1e-6 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-6
  )
}

export function pointOnPolyline(points, p) {
  for (let i = 0; i < points.length - 1; i++) {
    if (pointOnSegment(points[i], points[i + 1], p)) return true
  }
  return false
}

// The L-bend used while drawing a wire: from lastPoint to target, going `direction` first
// (horizontal|vertical), return the point(s) to APPEND after lastPoint — a corner then the
// target, or just the target if already aligned. Mirrors the logic previously inlined in
// useWireController (addWireWaypoint / completeWire / getPreviewPoint).
export function routeOrthogonal(lastPoint, target, direction) {
  const eq = (a, b) => a.x === b.x && a.y === b.y
  const corner =
    direction === 'horizontal' ? { x: target.x, y: lastPoint.y } : { x: lastPoint.x, y: target.y }
  const out = []
  // The corner is a real bend only when it differs from both ends (a straight run needs none).
  if (!eq(corner, lastPoint) && !eq(corner, target)) out.push(corner)
  if (!eq(target, lastPoint)) out.push({ x: target.x, y: target.y })
  return out
}

// Move one endpoint of an orthogonal polyline by `delta`, keeping the FAR endpoint and the far
// side of the polyline fixed, and keeping every segment axis-aligned. Returns a NEW points array
// (input is not mutated). `endIndex` must be 0 or points.length-1.
//
// The delta is split into the component parallel to the first segment (which simply stretches it)
// and the component perpendicular to it. The perpendicular part is absorbed by shifting the
// adjacent "elbow" when the next segment is perpendicular (so it stretches to take up the shift);
// otherwise a single elbow is inserted that preserves the first segment's orientation and pins the
// neighbor — this fallback is orthogonal on any polyline, including a straight 2-point wire.
export function stretchWireEndpoint(points, endIndex, delta) {
  const pts = points.map(p => ({ x: p.x, y: p.y }))
  const last = pts.length - 1
  if (endIndex !== 0 && endIndex !== last) return pts
  if (pts.length < 2) {
    pts[endIndex].x += delta.x
    pts[endIndex].y += delta.y
    return pts
  }

  const nbIndex = endIndex === 0 ? 1 : last - 1
  const ep = pts[endIndex]
  const el = pts[nbIndex]

  // First-segment orientation. A degenerate (coincident) first segment has no orientation, so
  // fall back to the dominant drag axis.
  let horizontal
  if (ep.y === el.y && ep.x !== el.x) horizontal = true
  else if (ep.x === el.x && ep.y !== el.y) horizontal = false
  else horizontal = Math.abs(delta.x) >= Math.abs(delta.y)

  // The endpoint follows its port by the full delta.
  ep.x += delta.x
  ep.y += delta.y

  const perp = horizontal ? delta.y : delta.x
  if (perp === 0) return pts // parallel-only stretch — first segment just lengthened

  // Is there a point beyond the neighbor, and is the next segment perpendicular to the first?
  const nnIndex = endIndex === 0 ? 2 : last - 2
  const hasInterior = nnIndex >= 0 && nnIndex <= last
  let seg2Perp = false
  if (hasInterior) {
    const nn = pts[nnIndex]
    seg2Perp = horizontal ? el.x === nn.x : el.y === nn.y
  }

  if (hasInterior && seg2Perp) {
    // Shift the existing elbow by the perpendicular component; the next segment stretches.
    if (horizontal) el.y += delta.y
    else el.x += delta.x
  } else {
    // Insert one elbow preserving the first segment's orientation; the neighbor stays put.
    const elbow = horizontal ? { x: el.x, y: ep.y } : { x: ep.x, y: el.y }
    const insertAt = endIndex === 0 ? 1 : last
    pts.splice(insertAt, 0, elbow)
  }
  return pts
}

// Clean up a polyline after a move: drop consecutive-duplicate points and merge collinear runs
// (three points sharing an x or a y — the middle is redundant). Endpoints are always kept.
export function normalizePolyline(points) {
  if (!points || points.length <= 2) return (points || []).map(p => ({ x: p.x, y: p.y }))

  const dedup = [{ x: points[0].x, y: points[0].y }]
  for (let i = 1; i < points.length; i++) {
    const a = dedup[dedup.length - 1]
    const b = points[i]
    if (a.x !== b.x || a.y !== b.y) dedup.push({ x: b.x, y: b.y })
  }
  if (dedup.length <= 2) return dedup

  const out = [dedup[0]]
  for (let i = 1; i < dedup.length - 1; i++) {
    const p = out[out.length - 1]
    const c = dedup[i]
    const n = dedup[i + 1]
    const collinear = (p.x === c.x && c.x === n.x) || (p.y === c.y && c.y === n.y)
    if (!collinear) out.push(c)
  }
  out.push(dedup[dedup.length - 1])
  return out
}
