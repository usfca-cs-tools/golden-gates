import { ref, computed } from 'vue'
import { componentRegistry } from '../utils/componentRegistry'
import { GRID_SIZE, gridToPixel, pixelToGrid } from '../utils/constants'
import { routeOrthogonal } from '../utils/orthogonalRouting'

export function useWireController(components, gridSize, callbacks = {}, circuitManager = null) {
  // Wire state - use passed refs or create local ones
  const wires = callbacks.wires || ref([])
  const wireJunctions = callbacks.wireJunctions || ref([])

  const selectedWires = ref(new Set())
  const drawingWire = ref(false)
  const wirePoints = ref([])
  const wireDirection = ref('horizontal') // 'horizontal' or 'vertical'
  const startConnection = ref(null)
  const currentMousePos = ref(null)

  // Use callbacks if provided, otherwise use local functions
  const addWire = callbacks.addWire || (wire => wires.value.push(wire))
  const removeWire = callbacks.removeWire || (index => wires.value.splice(index, 1))
  const addWireJunction =
    callbacks.addWireJunction || (junction => wireJunctions.value.push(junction))
  const removeWireJunction =
    callbacks.removeWireJunction || (index => wireJunctions.value.splice(index, 1))

  // Start drawing a wire from a connection point
  function startWireDrawing(componentId, portIndex, portType, mousePos) {
    const component = components.value.find(c => c.id === componentId)
    if (!component) return

    // Get the component configuration
    const config = componentRegistry[component.type]
    if (!config) return

    // Get the connection point position relative to component
    let connections
    if (config.getConnections) {
      // Use dynamic connections if available
      const dynamicConnections = config.getConnections(component.props, circuitManager)
      connections = portType === 'output' ? dynamicConnections.outputs : dynamicConnections.inputs
    } else {
      // Use static connections
      connections = portType === 'output' ? config.connections.outputs : config.connections.inputs
    }
    const connectionPoint = connections?.[portIndex]
    if (!connectionPoint) return

    // Calculate the actual connection point position
    // component.x/y are in grid units, connectionPoint.x/y are now in grid units
    const connectionPos = {
      x: component.x + connectionPoint.x,
      y: component.y + connectionPoint.y
    }

    // Store the starting connection info (componentId lets completeWire tell whether
    // an endpoint is a tunnel, so it can auto-orient it — see completeWire).
    startConnection.value = {
      componentId,
      portIndex,
      portType,
      pos: connectionPos
    }

    // Initialize wire drawing from the actual connection point
    drawingWire.value = true
    wirePoints.value = [connectionPos]

    // Determine initial direction based on port type
    wireDirection.value = portType === 'output' ? 'horizontal' : 'horizontal'
  }

  // Add a waypoint to the wire being drawn
  function addWireWaypoint(mousePos) {
    if (!drawingWire.value || wirePoints.value.length === 0) return

    const lastPoint = wirePoints.value[wirePoints.value.length - 1]

    // Snap the waypoint to the grid (convert to grid units)
    const snappedPos = {
      x: Math.round(mousePos.x / GRID_SIZE),
      y: Math.round(mousePos.y / GRID_SIZE)
    }

    // Add orthogonal points (corner then waypoint) based on current direction
    wirePoints.value.push(...routeOrthogonal(lastPoint, snappedPos, wireDirection.value))

    // Toggle direction for next segment
    wireDirection.value = wireDirection.value === 'horizontal' ? 'vertical' : 'horizontal'
  }

  // Complete wire drawing
  function completeWire(componentId, portIndex, portType) {
    if (!drawingWire.value || !startConnection.value) return

    // Get the end component and connection point
    const component = components.value.find(c => c.id === componentId)
    if (!component) return

    // A wire must join opposite port types (one output, one input). A tunnel is a virtual
    // wire whose single tap can act as either end, so if a tunnel is involved in an
    // otherwise same-type clash, orient the tunnel to match rather than silently dropping
    // the wire. Its port sits at the same coordinate in both directions (see
    // componentRegistry tunnel getConnections), so re-orienting never moves the endpoint.
    if (startConnection.value.portType === portType) {
      const startComponent = components.value.find(
        c => c.id === startConnection.value.componentId
      )
      if (component.type === 'tunnel') {
        portType = portType === 'output' ? 'input' : 'output'
        component.props = { ...component.props, direction: portType }
      } else if (startComponent?.type === 'tunnel') {
        const newDirection = startConnection.value.portType === 'output' ? 'input' : 'output'
        startComponent.props = { ...startComponent.props, direction: newDirection }
        startConnection.value.portType = newDirection
      } else {
        // Two like-typed, non-tunnel ports genuinely can't connect.
        cancelWireDrawing()
        return
      }
    }

    const config = componentRegistry[component.type]
    if (!config) return

    // Get the connection point position
    let connections
    if (config.getConnections) {
      // Use dynamic connections if available
      const dynamicConnections = config.getConnections(component.props, circuitManager)
      connections = portType === 'output' ? dynamicConnections.outputs : dynamicConnections.inputs
    } else {
      // Use static connections
      connections = portType === 'output' ? config.connections.outputs : config.connections.inputs
    }
    const connectionPoint = connections?.[portIndex]
    if (!connectionPoint) return

    // Calculate the actual connection point position
    // component.x/y are in grid units, connectionPoint.x/y are now in grid units
    const connectionPos = {
      x: component.x + connectionPoint.x,
      y: component.y + connectionPoint.y
    }

    // Ensure input/output are in correct order
    let inputConnection, outputConnection

    if (startConnection.value.portType === 'output') {
      outputConnection = startConnection.value
      inputConnection = {
        portIndex,
        portType,
        pos: connectionPos
      }
    } else {
      inputConnection = startConnection.value
      outputConnection = {
        portIndex,
        portType,
        pos: connectionPos
      }
    }

    // Add the final connection point using orthogonal routing to avoid diagonal lines
    if (wirePoints.value.length > 0) {
      const lastPoint = wirePoints.value[wirePoints.value.length - 1]
      wirePoints.value.push(...routeOrthogonal(lastPoint, connectionPos, wireDirection.value))
    } else {
      // If no waypoints, just add the connection point directly
      wirePoints.value.push(connectionPos)
    }

    // Get the final points array
    let finalPoints = [...wirePoints.value]

    // If we started from an input port, reverse the points to match logical flow
    // (from output to input)
    if (startConnection.value.portType === 'input') {
      finalPoints = finalPoints.reverse()
    }

    // Create the wire with points in the correct logical direction
    // Only store positions - connections will be derived from geometry
    const wire = {
      id: `wire_${Date.now()}`,
      points: finalPoints,
      startConnection: {
        pos: outputConnection.pos,
        portType: 'output'
      },
      endConnection: {
        pos: inputConnection.pos,
        portType: 'input'
      }
    }

    addWire(wire)

    // If this was a junction connection, add the junction point
    if (startConnection.value.isJunction) {
      wireJunctions.value.push({
        pos: startConnection.value.junctionPos,
        sourceWireIndex: startConnection.value.sourceWireIndex,
        connectedWireId: wire.id
      })
    }

    // Reset wire drawing state
    cancelWireDrawing()
  }

  // Cancel wire drawing
  function cancelWireDrawing() {
    drawingWire.value = false
    wirePoints.value = []
    startConnection.value = null
  }

  // Add a point to the wire being drawn
  function addPointToWire(pos) {
    if (!drawingWire.value) return
    wirePoints.value.push(pos)
  }

  // Get preview points for wire being drawn
  function getPreviewPoint(mousePos) {
    if (wirePoints.value.length === 0) return []

    const lastPoint = wirePoints.value[wirePoints.value.length - 1]
    const previewPoints = []

    // mousePos is already in grid units, so just round to nearest grid point
    const snappedPos = {
      x: Math.round(mousePos.x),
      y: Math.round(mousePos.y)
    }

    // Create orthogonal path based on current direction
    previewPoints.push(...routeOrthogonal(lastPoint, snappedPos, wireDirection.value))

    return previewPoints
  }

  // Find the closest grid vertex on a wire to a given point
  function findClosestGridPointOnWire(wireIndex, mousePos) {
    const wire = wires.value[wireIndex]
    if (!wire || wire.points.length < 2) return null

    let closestPoint = null
    let minDistance = Infinity

    // Check each segment of the wire
    for (let i = 0; i < wire.points.length - 1; i++) {
      const p1 = wire.points[i]
      const p2 = wire.points[i + 1]

      // Find grid points along this segment
      const isHorizontal = p1.y === p2.y
      const isVertical = p1.x === p2.x

      if (isHorizontal) {
        // Check grid vertices along horizontal segment
        const y = p1.y
        const minX = Math.min(p1.x, p2.x)
        const maxX = Math.max(p1.x, p2.x)

        // Round to nearest grid vertex
        const gridX = Math.round(mousePos.x / GRID_SIZE)

        // Check if this grid point is on the segment
        if (gridX >= minX && gridX <= maxX) {
          const distance =
            Math.abs(mousePos.x / GRID_SIZE - gridX) + Math.abs(mousePos.y / GRID_SIZE - y)
          if (distance < minDistance) {
            minDistance = distance
            closestPoint = { x: gridX, y: y }
          }
        }
      } else if (isVertical) {
        // Check grid vertices along vertical segment
        const x = p1.x
        const minY = Math.min(p1.y, p2.y)
        const maxY = Math.max(p1.y, p2.y)

        // Round to nearest grid vertex
        const gridY = Math.round(mousePos.y / GRID_SIZE)

        // Check if this grid point is on the segment
        if (gridY >= minY && gridY <= maxY) {
          const distance =
            Math.abs(mousePos.x / GRID_SIZE - x) + Math.abs(mousePos.y / GRID_SIZE - gridY)
          if (distance < minDistance) {
            minDistance = distance
            closestPoint = { x: x, y: gridY }
          }
        }
      }
    }

    // Only return if we found a point close enough (within one grid unit)
    return closestPoint && minDistance <= 1 ? closestPoint : null
  }

  // Start drawing a wire from a junction on an existing wire
  function startWireFromJunction(wireIndex, junctionPos) {
    const wire = wires.value[wireIndex]
    if (!wire) return

    // Use the original wire's source as our source - keep the original component position
    startConnection.value = {
      ...wire.startConnection // Keep original component position for finding the source
    }

    // Initialize wire drawing from the junction point
    drawingWire.value = true
    wirePoints.value = [junctionPos] // Start drawing from junction visually
    wireDirection.value = 'horizontal'

    // Store that this is a junction connection
    startConnection.value.isJunction = true
    startConnection.value.sourceWireIndex = wireIndex
    startConnection.value.junctionPos = junctionPos
  }

  // Complete a wire at a junction on an existing wire
  function completeWireAtJunction(wireIndex, junctionPos) {
    if (!drawingWire.value || !startConnection.value) return

    const targetWire = wires.value[wireIndex]
    if (!targetWire) return

    // Can't connect to the same wire we started from
    if (startConnection.value.sourceWireIndex === wireIndex) {
      cancelWireDrawing()
      return
    }

    // We need to determine if we started from an input or output
    if (startConnection.value.portType === 'input') {
      // Started from an input (like T), so we're connecting T to the wire's source
      // The wire should go FROM the target wire's source TO our input

      // Add the junction point as the final point
      wirePoints.value.push(junctionPos)

      // Create a wire from the target wire's source to our input
      const wire = {
        id: `wire_${Date.now()}`,
        points: [...wirePoints.value].reverse(), // Reverse points for correct direction
        startConnection: targetWire.startConnection, // Use target wire's source
        endConnection: startConnection.value // Our input is the destination
      }

      addWire(wire)

      // Add junction point
      wireJunctions.value.push({
        pos: junctionPos,
        sourceWireIndex: wireIndex,
        connectedWireId: wire.id
      })
    } else {
      // Started from an output, connecting to a wire is not typically done
      // but if it is, it would mean connecting our output to the wire's destination
      console.warn('Connecting from output to wire junction - unusual case')
      cancelWireDrawing()
      return
    }

    // Reset wire drawing state
    cancelWireDrawing()
  }

  // Select/deselect a wire
  // This function is replaced in CircuitCanvas to use the selection composable

  // Clean up junctions when wires are deleted
  function cleanupJunctionsForDeletedWires(deletedIndices, deletedWireIds) {
    // Find which junctions need to be removed (in reverse order to avoid index shifting)
    const junctionsToRemove = []

    wireJunctions.value.forEach((junction, index) => {
      // Remove junctions that were created from deleted wires
      const isSourceDeleted = deletedIndices.includes(junction.sourceWireIndex)
      // Remove junctions that connect to deleted wires
      const isConnectedDeleted = deletedWireIds.includes(junction.connectedWireId)

      if (isSourceDeleted || isConnectedDeleted) {
        junctionsToRemove.push(index)
      }
    })

    // Remove junctions using callback (in reverse order)
    junctionsToRemove.reverse().forEach(index => {
      removeWireJunction(index)
    })
  }

  // Delete selected wires
  function deleteSelectedWires() {
    // Sort indices in reverse order to avoid index shifting issues
    const indicesToDelete = Array.from(selectedWires.value).sort((a, b) => b - a)

    // Get the wire IDs that will be deleted
    const deletedWireIds = indicesToDelete.map(index => wires.value[index]?.id).filter(id => id)

    // Delete wires using callback
    indicesToDelete.forEach(index => {
      removeWire(index)
    })

    // Clean up junctions
    cleanupJunctionsForDeletedWires(indicesToDelete, deletedWireIds)

    selectedWires.value.clear()
  }

  // Computed preview points for wire being drawn
  const previewPoints = computed(() => {
    if (!drawingWire.value || wirePoints.value.length === 0) return []

    const mousePos = currentMousePos.value || { x: 0, y: 0 }
    const preview = getPreviewPoint(mousePos)

    return [...wirePoints.value, ...preview]
  })

  return {
    // State
    wires,
    selectedWires,
    drawingWire,
    wirePoints,
    wireDirection,
    startConnection,
    currentMousePos,
    previewPoints,
    wireJunctions,

    // Methods
    startWireDrawing,
    addWireWaypoint,
    completeWire,
    cancelWireDrawing,
    addPointToWire,
    deleteSelectedWires,
    findClosestGridPointOnWire,
    startWireFromJunction,
    completeWireAtJunction,
    cleanupJunctionsForDeletedWires
  }
}
