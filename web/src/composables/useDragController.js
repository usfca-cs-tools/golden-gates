import { ref } from 'vue'
import { GRID_SIZE } from '../utils/constants'
import { computeComponentPorts } from '../utils/portGeometry'
import { pointOnPolyline, stretchWireEndpoint, normalizePolyline } from '../utils/orthogonalRouting'

// Grid coordinates are integers at rest; key a moving port / wire endpoint by rounded grid pos.
const keyOf = (x, y) => `${Math.round(x)},${Math.round(y)}`

// Nearest point on a polyline to p, snapped to the grid. Used as a last resort to keep a junction
// on its host wire when a stretch reshaped the host out from under the tap — the tap must never
// silently detach (that's the "connected on screen, open in the engine" bug we're fixing).
function projectOntoPolyline(points, p) {
  let best = points[0]
  let bestD = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const q = { x: a.x + t * dx, y: a.y + t * dy }
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y) }
}

// Where a junction that taps a STRETCHING host wire should sit after the stretch. stretchWireEndpoint
// keeps the far portion of the host fixed and only reshapes the dragged end, so a tap on the fixed
// portion stays put, while a tap on the moving portion slides with the drag. Fall back to projecting
// onto the reshaped host so the junction is guaranteed to remain on the wire it taps.
function relocateJunctionOnStretch(oldPts, newPts, initialPos, delta) {
  if (pointOnPolyline(newPts, initialPos)) return { x: initialPos.x, y: initialPos.y }
  const shifted = { x: initialPos.x + delta.x, y: initialPos.y + delta.y }
  if (pointOnPolyline(newPts, shifted)) return shifted
  return projectOntoPolyline(newPts, initialPos)
}

export function useDragController(
  components,
  wires,
  selectedComponents,
  selectedWires,
  snapToGrid,
  wireJunctions,
  circuitManager = null
) {
  // Dragging state
  const dragging = ref(null)

  // ---------------------------------------------------------------------------
  // Connected-move engine (component drag + arrow-key nudge)
  //
  // When components move, wire endpoints that sit on their ports must follow, and wires that
  // cross the selection boundary must stretch. Connectivity is purely geometric (a wire endpoint
  // that coincides with a port grid cell is connected), so we anchor endpoints by exact grid-coord
  // match against the set of ports on the moving components.
  // ---------------------------------------------------------------------------

  // Absolute grid positions of every port on the moving components, from their INITIAL positions.
  function buildMovingPortSet(comps) {
    const set = new Map()
    for (const c of comps) {
      const comp = components.value.find(x => x.id === c.id)
      if (!comp) continue
      for (const p of computeComponentPorts(comp, circuitManager)) {
        // computeComponentPorts already bakes in rotation; only add the component origin.
        set.set(keyOf(c.initialX + p.x, c.initialY + p.y), {
          compId: c.id,
          portOffset: { x: p.x, y: p.y }
        })
      }
    }
    return set
  }

  // Classify each wire against the moving-port set. Records only the wires that move.
  //
  // A wire endpoint sitting on a component port is an obvious anchor. But a branch wire tapped
  // off a T-junction (see useWireController's startWireFromJunction / completeWireAtJunction) has
  // one endpoint that sits on a JUNCTION instead -- a point on another wire's middle, not a port.
  // That junction is a real, permanent connection: wireJunctions already records exactly which
  // wire it taps and where. So once we know the host wire is itself moving rigidly, its junction
  // point is just as much a moving anchor as a port is. We grow the anchor set with junction
  // points that land on a currently-rigid wire and re-classify, repeating until nothing new is
  // found -- so a branch tapped off another branch resolves too, not just one level deep.
  function classifyWires(movingPortSet) {
    const movingAnchors = new Map(movingPortSet)
    const records = new Map()

    const evaluate = (wire, index) => {
      const pts = wire.points
      if (!pts || pts.length === 0) return null
      const anchorStart = movingAnchors.get(keyOf(pts[0].x, pts[0].y)) || null
      const anchorEnd =
        movingAnchors.get(keyOf(pts[pts.length - 1].x, pts[pts.length - 1].y)) || null
      const selected = selectedWires.value.has(index)

      let moveType
      if (anchorStart && anchorEnd)
        moveType = 'rigid' // both ends on moving anchors -> translate
      else if (anchorStart) moveType = 'stretchStart'
      else if (anchorEnd) moveType = 'stretchEnd'
      else if (selected)
        moveType = 'rigid' // explicitly selected but unanchored -> translate (as before)
      else return null // untouched

      return {
        index,
        initialPoints: pts.map(p => ({ x: p.x, y: p.y })),
        moveType,
        anchorStart,
        anchorEnd
      }
    }

    wires.value.forEach((wire, index) => {
      const rec = evaluate(wire, index)
      if (rec) records.set(index, rec)
    })

    if (wireJunctions && wireJunctions.value) {
      let grew = true
      while (grew) {
        grew = false
        const rigidPolylines = Array.from(records.values())
          .filter(r => r.moveType === 'rigid')
          .map(r => r.initialPoints)

        for (const junction of wireJunctions.value) {
          const key = keyOf(junction.pos.x, junction.pos.y)
          if (movingAnchors.has(key)) continue
          if (rigidPolylines.some(poly => pointOnPolyline(poly, junction.pos))) {
            movingAnchors.set(key, { junction: true })
            grew = true
          }
        }
        if (!grew) break

        wires.value.forEach((wire, index) => {
          const rec = evaluate(wire, index)
          if (rec) records.set(index, rec)
        })
      }
    }

    return Array.from(records.values())
  }

  // Which junctions ride along with a set of rigidly-translated wires. Resolve by geometry (the
  // junction sits on the wire it taps) plus the stable connectedWireId — NOT the serialized
  // sourceWireIndex, a positional index that goes stale. (classifyWires above now folds a riding
  // junction's tap point into the moving-anchor set, so the branch wire started from it is
  // reclassified as rigid too, instead of being left stretched from a stale point.) Junctions whose
  // host wire only STRETCHES are handled separately by collectStretchJunctions below.
  function collectRidingJunctions(rigidRecords) {
    const result = []
    if (!wireJunctions || !wireJunctions.value) return result
    wireJunctions.value.forEach((junction, junctionIndex) => {
      const rides = rigidRecords.some(w => {
        const wire = wires.value[w.index]
        return (
          wire &&
          (wire.id === junction.connectedWireId || pointOnPolyline(w.initialPoints, junction.pos))
        )
      })
      if (rides) {
        result.push({ index: junctionIndex, initialPos: { x: junction.pos.x, y: junction.pos.y } })
      }
    })
    return result
  }

  // The wire tapping `junction` from the branch side: a wire (other than the host) with an ENDPOINT
  // on the junction. Returns { index, end: 'start'|'end', initialPoints } or null. Only UNCLASSIFIED
  // branches are returned — a branch already in the move set (e.g. its far end is on a moving port)
  // is reshaped by the main wire loop and must not be moved twice.
  function findTapBranch(junction, hostWireIndex, movingIndices) {
    const jkey = keyOf(junction.pos.x, junction.pos.y)
    for (let wi = 0; wi < wires.value.length; wi++) {
      if (wi === hostWireIndex || movingIndices.has(wi)) continue
      const pts = wires.value[wi].points
      if (!pts || pts.length === 0) continue
      const initialPoints = pts.map(p => ({ x: p.x, y: p.y }))
      if (keyOf(pts[0].x, pts[0].y) === jkey) return { index: wi, end: 'start', initialPoints }
      const last = pts.length - 1
      if (keyOf(pts[last].x, pts[last].y) === jkey) return { index: wi, end: 'end', initialPoints }
    }
    return null
  }

  // Junctions whose HOST wire only STRETCHES (is not translated rigidly). classifyWires' anchor
  // folding above rescues junctions on RIGID hosts (and reclassifies their branches rigid); a
  // stretch reshapes the host in place, which can slide the tap off it, leaving the junction — and
  // the branch wire that taps it — behind. Carry each such junction with its host record and its
  // (unclassified) branch, so applyConnectedMove can keep both on the reshaped host. This is the
  // limitation the rigid fix explicitly left open.
  function collectStretchJunctions(records) {
    const result = []
    if (!wireJunctions || !wireJunctions.value) return result
    const movingIndices = new Set(records.map(r => r.index))
    const rigid = records.filter(r => r.moveType === 'rigid')
    const stretch = records.filter(r => r.moveType !== 'rigid')
    const hostsFor = junction => rec => {
      const wire = wires.value[rec.index]
      return (
        wire &&
        (wire.id === junction.connectedWireId || pointOnPolyline(rec.initialPoints, junction.pos))
      )
    }
    wireJunctions.value.forEach((junction, jIndex) => {
      if (rigid.some(hostsFor(junction))) return // already carried by the rigid path
      const host = stretch.find(hostsFor(junction))
      if (!host) return
      result.push({
        index: jIndex,
        initialPos: { x: junction.pos.x, y: junction.pos.y },
        hostWireIndex: host.index,
        branch: findTapBranch(junction, host.index, movingIndices)
      })
    })
    return result
  }

  // Snapshot the current selection into a move context (used by both drag and nudge).
  function buildMoveContext() {
    const comps = []
    for (const compId of selectedComponents.value) {
      const comp = components.value.find(c => c.id === compId)
      if (comp) comps.push({ id: comp.id, initialX: comp.x, initialY: comp.y })
    }
    const movingPortSet = buildMovingPortSet(comps)
    const wireRecords = classifyWires(movingPortSet)
    const junctions = collectRidingJunctions(wireRecords.filter(w => w.moveType === 'rigid'))
    const stretchJunctions = collectStretchJunctions(wireRecords)
    return {
      components: comps,
      wires: wireRecords,
      junctions,
      stretchJunctions,
      refId: comps[0]?.id ?? null,
      lockedAxis: null, // set once Shift-drag commits to an axis; held until Shift is released
      lastDelta: { x: 0, y: 0 }
    }
  }

  // Apply a grid delta to the whole context: move components; translate/stretch each wire; ride
  // junctions. axisLock zeroes the minor component of the delta so a drag holds one axis.
  function applyConnectedMove(context, rawDelta, opts = {}) {
    let dx = rawDelta.x
    let dy = rawDelta.y
    if (opts.axisLock) {
      // Latch the axis on the first committed movement and HOLD it for the rest of the drag. If we
      // instead recomputed the dominant axis every move, the lock would flip axes mid-drag (start
      // on X, drift in Y) — yanking components and re-routing their wires onto the other axis.
      if (!context.lockedAxis && Math.max(Math.abs(dx), Math.abs(dy)) > 0.5) {
        context.lockedAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      }
      if (context.lockedAxis === 'x') dy = 0
      else if (context.lockedAxis === 'y') dx = 0
    } else if (context.lockedAxis) {
      context.lockedAxis = null // Shift released: resume free movement, re-latch on the next press
    }
    const delta = { x: dx, y: dy }
    context.lastDelta = delta

    for (const c of context.components) {
      const comp = components.value.find(x => x.id === c.id)
      if (comp) {
        comp.x = c.initialX + dx
        comp.y = c.initialY + dy
      }
    }

    for (const rec of context.wires) {
      const wire = wires.value[rec.index]
      if (!wire) continue
      let pts
      if (rec.moveType === 'rigid') {
        pts = rec.initialPoints.map(p => ({ x: p.x + dx, y: p.y + dy }))
      } else if (rec.moveType === 'stretchStart') {
        pts = stretchWireEndpoint(rec.initialPoints, 0, delta)
      } else {
        pts = stretchWireEndpoint(rec.initialPoints, rec.initialPoints.length - 1, delta)
      }
      wire.points = pts
      wire.startConnection.pos = { x: pts[0].x, y: pts[0].y }
      wire.endConnection.pos = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
    }

    if (wireJunctions && wireJunctions.value) {
      for (const j of context.junctions) {
        const junction = wireJunctions.value[j.index]
        if (junction) {
          junction.pos.x = j.initialPos.x + dx
          junction.pos.y = j.initialPos.y + dy
        }
      }
      // Junctions on a stretching host: keep the dot on the reshaped host, and slide its branch's
      // tapping end to follow, so the tap stays attached instead of detaching mid-frame.
      for (const sj of context.stretchJunctions || []) {
        const junction = wireJunctions.value[sj.index]
        const host = wires.value[sj.hostWireIndex]
        const hostRec = context.wires.find(r => r.index === sj.hostWireIndex)
        if (!junction || !host || !hostRec) continue
        const newPos = relocateJunctionOnStretch(
          hostRec.initialPoints,
          host.points,
          sj.initialPos,
          {
            x: dx,
            y: dy
          }
        )
        junction.pos.x = newPos.x
        junction.pos.y = newPos.y
        if (sj.branch) {
          const bw = wires.value[sj.branch.index]
          if (bw) {
            const endIdx = sj.branch.end === 'start' ? 0 : sj.branch.initialPoints.length - 1
            const pts = stretchWireEndpoint(sj.branch.initialPoints, endIdx, {
              x: newPos.x - sj.initialPos.x,
              y: newPos.y - sj.initialPos.y
            })
            bw.points = pts
            bw.startConnection.pos = { x: pts[0].x, y: pts[0].y }
            bw.endConnection.pos = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
          }
        }
      }
    }
  }

  // Finish a connected move: optionally snap the reference component to grid, re-apply, then
  // re-anchor moved endpoints to EXACT port positions (integer vertices, exact connectivity) and
  // normalize each polyline.
  function finalizeMove(context, { snap }) {
    let delta = context.lastDelta
    if (snap && context.components.length) {
      const ref = context.components.find(c => c.id === context.refId) || context.components[0]
      const snapped = snapToGrid({
        x: (ref.initialX + delta.x) * GRID_SIZE,
        y: (ref.initialY + delta.y) * GRID_SIZE
      })
      delta = { x: snapped.x / GRID_SIZE - ref.initialX, y: snapped.y / GRID_SIZE - ref.initialY }
    }
    // Re-apply at the final delta (already axis-locked from the live drag; do not re-lock).
    applyConnectedMove(context, delta, {})

    for (const rec of context.wires) {
      const wire = wires.value[rec.index]
      if (!wire) continue
      if (rec.anchorStart) {
        const comp = components.value.find(c => c.id === rec.anchorStart.compId)
        if (comp) {
          const pos = {
            x: comp.x + rec.anchorStart.portOffset.x,
            y: comp.y + rec.anchorStart.portOffset.y
          }
          wire.points[0] = pos
        }
      }
      if (rec.anchorEnd) {
        const comp = components.value.find(c => c.id === rec.anchorEnd.compId)
        if (comp) {
          const pos = {
            x: comp.x + rec.anchorEnd.portOffset.x,
            y: comp.y + rec.anchorEnd.portOffset.y
          }
          wire.points[wire.points.length - 1] = pos
        }
      }
      wire.points = normalizePolyline(wire.points)
      wire.startConnection.pos = { x: wire.points[0].x, y: wire.points[0].y }
      const lp = wire.points[wire.points.length - 1]
      wire.endConnection.pos = { x: lp.x, y: lp.y }
    }
  }

  // Arrow-key nudge: same connected-move logic as drag, applied once by an integer grid delta.
  function nudgeSelection(delta) {
    const context = buildMoveContext()
    if (context.components.length === 0 && context.wires.length === 0) return false
    applyConnectedMove(context, delta, {})
    finalizeMove(context, { snap: false })
    return true
  }

  // ---------------------------------------------------------------------------
  // Bare-wire drag (dragging a selected wire directly) — rigid translation, unchanged behavior.
  // ---------------------------------------------------------------------------

  function applyRigidLists(deltaX, deltaY) {
    for (const dragInfo of dragging.value.components) {
      const component = components.value.find(c => c.id === dragInfo.id)
      if (component) {
        component.x = dragInfo.initialX + deltaX
        component.y = dragInfo.initialY + deltaY
      }
    }
    for (const wireInfo of dragging.value.wires) {
      const wire = wires.value[wireInfo.index]
      if (wire) {
        for (let i = 0; i < wire.points.length; i++) {
          wire.points[i] = {
            x: wireInfo.initialPoints[i].x + deltaX,
            y: wireInfo.initialPoints[i].y + deltaY
          }
        }
        wire.startConnection.pos.x = wireInfo.initialPoints[0].x + deltaX
        wire.startConnection.pos.y = wireInfo.initialPoints[0].y + deltaY
        wire.endConnection.pos.x =
          wireInfo.initialPoints[wireInfo.initialPoints.length - 1].x + deltaX
        wire.endConnection.pos.y =
          wireInfo.initialPoints[wireInfo.initialPoints.length - 1].y + deltaY
      }
    }
    if (wireJunctions && wireJunctions.value && dragging.value.junctions) {
      for (const junctionInfo of dragging.value.junctions) {
        const junction = wireJunctions.value[junctionInfo.index]
        if (junction) {
          junction.pos.x = junctionInfo.initialPos.x + deltaX
          junction.pos.y = junctionInfo.initialPos.y + deltaY
        }
        // The branch tapping this junction rides too: its tapping end follows the trunk by the same
        // delta while its far end (an unselected port) stays, so the branch stretches to keep up.
        if (junctionInfo.branch) {
          const bw = wires.value[junctionInfo.branch.index]
          if (bw) {
            const endIdx =
              junctionInfo.branch.end === 'start' ? 0 : junctionInfo.branch.initialPoints.length - 1
            const pts = stretchWireEndpoint(junctionInfo.branch.initialPoints, endIdx, {
              x: deltaX,
              y: deltaY
            })
            bw.points = pts
            bw.startConnection.pos = { x: pts[0].x, y: pts[0].y }
            bw.endConnection.pos = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Drag lifecycle
  // ---------------------------------------------------------------------------

  // Start dragging components (connected drag).
  function startDrag(dragInfo) {
    const { id, offsetX, offsetY, event } = dragInfo

    // Command/Ctrl toggles multi-select
    const isMultiSelect = event?.metaKey || event?.ctrlKey
    if (isMultiSelect) {
      if (selectedComponents.value.has(id)) {
        selectedComponents.value.delete(id)
        if (!selectedComponents.value.has(id)) return
      } else {
        selectedComponents.value.add(id)
      }
    } else {
      if (!selectedComponents.value.has(id)) {
        selectedComponents.value.clear()
        selectedWires.value.clear()
      }
      selectedComponents.value.add(id)
    }

    const component = components.value.find(c => c.id === id)
    if (!component) return

    const context = buildMoveContext()
    context.refId = id

    dragging.value = {
      id,
      offsetX, // pixels
      offsetY, // pixels
      hasMoved: false,
      mode: 'component',
      context
    }
  }

  // Start dragging a selected wire directly (rigid translation).
  function startWireDrag(wireIndex, dragInfo) {
    if (!selectedWires.value.has(wireIndex)) return

    const { offsetX, offsetY } = dragInfo

    const draggedComponents = []
    for (const compId of selectedComponents.value) {
      const comp = components.value.find(c => c.id === compId)
      if (comp) draggedComponents.push({ id: comp.id, initialX: comp.x, initialY: comp.y })
    }

    const draggedWires = []
    for (const index of selectedWires.value) {
      const wire = wires.value[index]
      if (wire)
        draggedWires.push({ index, initialPoints: wire.points.map(p => ({ x: p.x, y: p.y })) })
    }

    // Junctions ride the selected wires (geometry / stable id). Each junction's branch wire — the
    // one that taps the trunk here — must ride too, or dragging the trunk leaves the branch's
    // endpoint behind and the tap detaches. Carry the (unselected) branch so it follows the delta.
    const draggedJunctions = []
    if (wireJunctions && wireJunctions.value) {
      const movingIndices = new Set(draggedWires.map(w => w.index))
      wireJunctions.value.forEach((junction, junctionIndex) => {
        const host = draggedWires.find(w => {
          const wire = wires.value[w.index]
          return (
            wire &&
            (wire.id === junction.connectedWireId || pointOnPolyline(w.initialPoints, junction.pos))
          )
        })
        if (host) {
          draggedJunctions.push({
            index: junctionIndex,
            initialPos: { x: junction.pos.x, y: junction.pos.y },
            branch: findTapBranch(junction, host.index, movingIndices)
          })
        }
      })
    }

    dragging.value = {
      id: dragInfo.id,
      offsetX,
      offsetY,
      hasMoved: false,
      components: draggedComponents,
      wires: draggedWires,
      junctions: draggedJunctions,
      isWireDrag: true
    }
  }

  // Update positions during drag
  function updateDrag(mousePos, opts = {}) {
    if (!dragging.value) return

    const newX = (mousePos.x - dragging.value.offsetX) / GRID_SIZE
    const newY = (mousePos.y - dragging.value.offsetY) / GRID_SIZE
    dragging.value.hasMoved = true

    if (dragging.value.isWireDrag) {
      const firstWire = wires.value[dragging.value.wires[0].index]
      if (!firstWire) return
      const deltaX = newX - dragging.value.wires[0].initialPoints[0].x
      const deltaY = newY - dragging.value.wires[0].initialPoints[0].y
      applyRigidLists(deltaX, deltaY)
      return
    }

    const ctx = dragging.value.context
    const ref = ctx.components.find(c => c.id === dragging.value.id) || ctx.components[0]
    if (!ref) return
    applyConnectedMove(
      ctx,
      { x: newX - ref.initialX, y: newY - ref.initialY },
      {
        axisLock: opts.axisLock
      }
    )
  }

  // End dragging with snap to grid
  function endDrag() {
    if (!dragging.value) return false
    const moved = !!dragging.value.hasMoved

    if (moved) {
      if (dragging.value.isWireDrag) {
        // Snap the first point of the first wire, re-apply the snapped delta rigidly.
        const firstWire = wires.value[dragging.value.wires[0].index]
        if (firstWire) {
          const snapped = snapToGrid({
            x: firstWire.points[0].x * GRID_SIZE,
            y: firstWire.points[0].y * GRID_SIZE
          })
          const deltaX = snapped.x / GRID_SIZE - dragging.value.wires[0].initialPoints[0].x
          const deltaY = snapped.y / GRID_SIZE - dragging.value.wires[0].initialPoints[0].y
          applyRigidLists(deltaX, deltaY)
        }
      } else {
        finalizeMove(dragging.value.context, { snap: true })
      }
    }

    dragging.value = null
    return moved
  }

  // Abort the in-progress drag (Escape): restore everything to its pre-drag position by applying a
  // zero delta, then drop the drag without snapping or finalizing. A later mouseup no-ops because
  // dragging is cleared. (The pre-drag undo snapshot stays on the stack; undoing it is a no-op since
  // state is already restored.)
  function cancelDrag() {
    if (!dragging.value) return false
    if (dragging.value.isWireDrag) {
      applyRigidLists(0, 0)
    } else {
      applyConnectedMove(dragging.value.context, { x: 0, y: 0 }, {})
    }
    dragging.value = null
    return true
  }

  function isDragging() {
    return dragging.value !== null
  }

  return {
    dragging,
    startDrag,
    startWireDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    nudgeSelection,
    isDragging
  }
}
