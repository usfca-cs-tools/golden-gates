import { ref } from 'vue'
import { GRID_SIZE } from '../utils/constants'
import { computeComponentPorts } from '../utils/portGeometry'
import { pointOnPolyline, stretchWireEndpoint, normalizePolyline } from '../utils/orthogonalRouting'

// Grid coordinates are integers at rest; key a moving port / wire endpoint by rounded grid pos.
const keyOf = (x, y) => `${Math.round(x)},${Math.round(y)}`

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
  function classifyWires(movingPortSet) {
    const records = []
    wires.value.forEach((wire, index) => {
      const pts = wire.points
      if (!pts || pts.length === 0) return
      const anchorStart = movingPortSet.get(keyOf(pts[0].x, pts[0].y)) || null
      const anchorEnd =
        movingPortSet.get(keyOf(pts[pts.length - 1].x, pts[pts.length - 1].y)) || null
      const selected = selectedWires.value.has(index)

      let moveType
      if (anchorStart && anchorEnd)
        moveType = 'rigid' // both ends on moving ports -> translate
      else if (anchorStart) moveType = 'stretchStart'
      else if (anchorEnd) moveType = 'stretchEnd'
      else if (selected)
        moveType = 'rigid' // explicitly selected but unanchored -> translate (as before)
      else return // untouched

      records.push({
        index,
        initialPoints: pts.map(p => ({ x: p.x, y: p.y })),
        moveType,
        anchorStart,
        anchorEnd
      })
    })
    return records
  }

  // Which junctions ride along with a set of rigidly-translated wires. Resolve by geometry (the
  // junction sits on the wire it taps) plus the stable connectedWireId — NOT the serialized
  // sourceWireIndex, a positional index that goes stale. (Junctions on STRETCHED wires are
  // best-effort and not carried — a documented limitation.)
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
    return {
      components: comps,
      wires: wireRecords,
      junctions,
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

    // Junctions ride the selected wires (geometry / stable id).
    const draggedJunctions = []
    if (wireJunctions && wireJunctions.value) {
      wireJunctions.value.forEach((junction, junctionIndex) => {
        const rides = draggedWires.some(w => {
          const wire = wires.value[w.index]
          return (
            wire &&
            (wire.id === junction.connectedWireId || pointOnPolyline(w.initialPoints, junction.pos))
          )
        })
        if (rides) {
          draggedJunctions.push({
            index: junctionIndex,
            initialPos: { x: junction.pos.x, y: junction.pos.y }
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
