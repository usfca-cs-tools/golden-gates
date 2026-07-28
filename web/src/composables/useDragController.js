import { ref } from 'vue'
import { GRID_SIZE } from '../utils/constants'

export function useDragController(
  components,
  wires,
  selectedComponents,
  selectedWires,
  snapToGrid,
  wireJunctions
) {
  // Dragging state
  const dragging = ref(null)

  // Start dragging components or wires
  function startDrag(dragInfo) {
    const { id, offsetX, offsetY, event } = dragInfo

    // Check if Command key is held for multi-select
    const isMultiSelect = event?.metaKey || event?.ctrlKey

    // If multi-selecting, toggle the component's selection
    if (isMultiSelect) {
      if (selectedComponents.value.has(id)) {
        selectedComponents.value.delete(id)
        // If we just deselected the component, don't start dragging
        if (!selectedComponents.value.has(id)) {
          return
        }
      } else {
        selectedComponents.value.add(id)
      }
    } else {
      // If not multi-selecting and clicked component isn't selected, clear all selections
      if (!selectedComponents.value.has(id)) {
        selectedComponents.value.clear()
        selectedWires.value.clear()
      }
      // Add the clicked component to selection
      selectedComponents.value.add(id)
    }

    // Find the component
    const component = components.value.find(c => c.id === id)
    if (!component) return

    // Store initial positions of all selected components
    const draggedComponents = []
    for (const compId of selectedComponents.value) {
      const comp = components.value.find(c => c.id === compId)
      if (comp) {
        draggedComponents.push({
          id: comp.id,
          initialX: comp.x,
          initialY: comp.y
        })
      }
    }

    // Store initial positions of all selected wires
    const draggedWires = []
    for (const wireIndex of selectedWires.value) {
      const wire = wires.value[wireIndex]
      if (wire) {
        draggedWires.push({
          index: wireIndex,
          initialPoints: wire.points.map(p => ({ x: p.x, y: p.y }))
        })
      }
    }

    // Store initial positions of junctions that need to move with selected wires
    const draggedJunctions = []
    if (wireJunctions && wireJunctions.value) {
      wireJunctions.value.forEach((junction, junctionIndex) => {
        // Check if this junction's source wire is being dragged
        const sourceWireDragged = draggedWires.some(
          wireInfo => wireInfo.index === junction.sourceWireIndex
        )
        if (sourceWireDragged) {
          draggedJunctions.push({
            index: junctionIndex,
            initialPos: { x: junction.pos.x, y: junction.pos.y }
          })
        }
      })
    }

    dragging.value = {
      id,
      offsetX: offsetX, // Keep offset in pixels
      offsetY: offsetY, // Keep offset in pixels
      hasMoved: false,
      components: draggedComponents,
      wires: draggedWires,
      junctions: draggedJunctions
    }
  }

  // Start dragging wires
  function startWireDrag(wireIndex, dragInfo) {
    // Only start drag if the wire is selected
    if (!selectedWires.value.has(wireIndex)) return

    const { offsetX, offsetY } = dragInfo

    // Store initial positions of all selected components (if any)
    const draggedComponents = []
    for (const compId of selectedComponents.value) {
      const comp = components.value.find(c => c.id === compId)
      if (comp) {
        draggedComponents.push({
          id: comp.id,
          initialX: comp.x,
          initialY: comp.y
        })
      }
    }

    // Store initial positions of all selected wires
    const draggedWires = []
    for (const index of selectedWires.value) {
      const wire = wires.value[index]
      if (wire) {
        draggedWires.push({
          index,
          initialPoints: wire.points.map(p => ({ x: p.x, y: p.y }))
        })
      }
    }

    // Store initial positions of junctions that need to move with selected wires
    const draggedJunctions = []
    if (wireJunctions && wireJunctions.value) {
      wireJunctions.value.forEach((junction, junctionIndex) => {
        // Check if this junction's source wire is being dragged
        const sourceWireDragged = selectedWires.value.has(junction.sourceWireIndex)
        if (sourceWireDragged) {
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
      components: draggedComponents, // Include selected components when dragging wires
      wires: draggedWires,
      junctions: draggedJunctions,
      isWireDrag: true
    }
  }

  // Update positions during drag
  function updateDrag(mousePos) {
    if (!dragging.value) return

    // Convert mouse position to grid units and apply offset (offset is in pixels)
    const newX = (mousePos.x - dragging.value.offsetX) / GRID_SIZE
    const newY = (mousePos.y - dragging.value.offsetY) / GRID_SIZE

    // Mark that we've moved
    dragging.value.hasMoved = true

    // Calculate the delta
    let deltaX, deltaY

    if (dragging.value.isWireDrag) {
      // For wire dragging, use the first wire's first point as reference
      const firstWire = wires.value[dragging.value.wires[0].index]
      if (!firstWire) return
      // Both newX/Y and initialPoints are in grid units
      deltaX = newX - dragging.value.wires[0].initialPoints[0].x
      deltaY = newY - dragging.value.wires[0].initialPoints[0].y
    } else {
      // For component dragging, use the dragged component as reference
      const draggedComp = dragging.value.components.find(c => c.id === dragging.value.id)
      if (!draggedComp) return
      // Both positions are already in grid units
      deltaX = newX - draggedComp.initialX
      deltaY = newY - draggedComp.initialY
    }

    // Update all selected components by the same delta
    for (const dragInfo of dragging.value.components) {
      const component = components.value.find(c => c.id === dragInfo.id)
      if (component) {
        // Apply delta in grid units (initialX/Y are already in grid units)
        component.x = dragInfo.initialX + deltaX
        component.y = dragInfo.initialY + deltaY
      }
    }

    // Update all affected wires
    for (const wireInfo of dragging.value.wires) {
      const wire = wires.value[wireInfo.index]
      if (wire) {
        // Update each point in the wire
        for (let i = 0; i < wire.points.length; i++) {
          wire.points[i] = {
            x: wireInfo.initialPoints[i].x + deltaX,
            y: wireInfo.initialPoints[i].y + deltaY
          }
        }

        // Update connection positions
        wire.startConnection.pos.x = wireInfo.initialPoints[0].x + deltaX
        wire.startConnection.pos.y = wireInfo.initialPoints[0].y + deltaY
        wire.endConnection.pos.x =
          wireInfo.initialPoints[wireInfo.initialPoints.length - 1].x + deltaX
        wire.endConnection.pos.y =
          wireInfo.initialPoints[wireInfo.initialPoints.length - 1].y + deltaY
      }
    }


    // Update junction positions
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

  // End dragging with snap to grid
  function endDrag(snapToGrid) {
    if (!dragging.value) return

    // Only snap if we actually moved
    if (dragging.value.hasMoved) {
      let snappedDeltaX = 0
      let snappedDeltaY = 0

      if (dragging.value.isWireDrag) {
        // For wire dragging, snap the first point of the first wire
        const firstWire = wires.value[dragging.value.wires[0].index]
        if (firstWire) {
          // Wire points are in grid units, convert to pixels for snapping
          const snapped = snapToGrid({
            x: firstWire.points[0].x * GRID_SIZE,
            y: firstWire.points[0].y * GRID_SIZE
          })
          // Calculate delta in grid units (both snapped and initialPoints are in grid units)
          snappedDeltaX = snapped.x / GRID_SIZE - dragging.value.wires[0].initialPoints[0].x
          snappedDeltaY = snapped.y / GRID_SIZE - dragging.value.wires[0].initialPoints[0].y
        }
      } else {
        // For component dragging, find the current position of the dragged component
        const draggedComp = components.value.find(c => c.id === dragging.value.id)
        if (draggedComp) {
          // Components are already in grid units, convert to pixels for snapping
          const snapped = snapToGrid({ x: draggedComp.x * GRID_SIZE, y: draggedComp.y * GRID_SIZE })
          const initialComp = dragging.value.components.find(c => c.id === dragging.value.id)
          if (initialComp) {
            // Calculate delta in grid units (snapped is now in pixels, so convert back)
            snappedDeltaX = snapped.x / GRID_SIZE - initialComp.initialX
            snappedDeltaY = snapped.y / GRID_SIZE - initialComp.initialY
          }
        }
      }

      // Apply the snapped delta to all selected components
      for (const dragInfo of dragging.value.components) {
        const component = components.value.find(c => c.id === dragInfo.id)
        if (component) {
          // Apply delta in grid units (initialX/Y are already in grid units)
          component.x = dragInfo.initialX + snappedDeltaX
          component.y = dragInfo.initialY + snappedDeltaY
        }
      }

      // Apply the snapped delta to all affected wires
      for (const wireInfo of dragging.value.wires) {
        const wire = wires.value[wireInfo.index]
        if (wire) {
          // Update each point in the wire
          for (let i = 0; i < wire.points.length; i++) {
            wire.points[i] = {
              x: wireInfo.initialPoints[i].x + snappedDeltaX,
              y: wireInfo.initialPoints[i].y + snappedDeltaY
            }
          }

          // Update connection positions
          wire.startConnection.pos.x = wireInfo.initialPoints[0].x + snappedDeltaX
          wire.startConnection.pos.y = wireInfo.initialPoints[0].y + snappedDeltaY
          wire.endConnection.pos.x =
            wireInfo.initialPoints[wireInfo.initialPoints.length - 1].x + snappedDeltaX
          wire.endConnection.pos.y =
            wireInfo.initialPoints[wireInfo.initialPoints.length - 1].y + snappedDeltaY
        }
      }

      // Apply the snapped delta to all affected junctions
      if (wireJunctions && wireJunctions.value && dragging.value.junctions) {
        for (const junctionInfo of dragging.value.junctions) {
          const junction = wireJunctions.value[junctionInfo.index]
          if (junction) {
            junction.pos.x = junctionInfo.initialPos.x + snappedDeltaX
            junction.pos.y = junctionInfo.initialPos.y + snappedDeltaY
          }
        }
      }
    }

    dragging.value = null
  }

  // Check if currently dragging
  function isDragging() {
    return dragging.value !== null
  }

  return {
    // State
    dragging,

    // Methods
    startDrag,
    startWireDrag,
    updateDrag,
    endDrag,
    isDragging
  }
}
