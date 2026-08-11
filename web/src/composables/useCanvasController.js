import { ref, computed } from 'vue'
import { useComponentController } from './useComponentController'
import { useClipboard } from './useClipboard'
import { GRID_SIZE, gridToPixel, pixelToGrid } from '../utils/constants'

/**
 * Canvas Interactions - UI interaction logic for circuit canvas
 * Provides controller layer functionality for canvas user interactions
 */
export function useCanvasController(
  circuitManager,
  canvasOperations,
  wireManagement,
  selection,
  dragAndDrop,
  undoCallbacks = {}
) {
  const { getMousePos, snapToGrid, gridSize, panX, panY, isPanning } = canvasOperations
  const { clearSelection, selectComponent, deleteSelected, checkAndClearJustFinished } = selection
  const { startWireDrawing, completeWire, addWireWaypoint, cancelWireDrawing, drawingWire } =
    wireManagement
  const { isDragging, updateDrag, endDrag, cancelDrag, nudgeSelection } = dragAndDrop
  const { activeCircuit } = circuitManager

  // Component controller for component-related logic
  const componentController = useComponentController(circuitManager, canvasOperations)
  const {
    lastComponentPosition,
    addComponentAtSmartPosition,
    getComponentConnections,
    updateLastComponentPosition
  } = componentController

  // Clipboard controller for copy/paste operations
  const clipboardController = useClipboard()

  // Junction mode tracking for Alt key feedback
  const isJunctionMode = ref(false)
  const junctionPreview = ref(null)
  const connectionPreview = ref(null)

  // Store the last hovered wire for re-evaluation when mode changes
  let lastHoveredWireIndex = null

  // Touch pan tracking
  let lastTouchDistance = null
  let lastPanPosition = null
  let activeTouches = []

  // Debounce mechanism to prevent duplicate operations
  const OPERATION_DEBOUNCE_MS = 100
  const lastOperationTimes = {
    paste: 0,
    duplicate: 0
  }

  /**
   * Check if operation should be debounced
   */
  function shouldDebounceOperation(operationType) {
    const currentTime = Date.now()
    if (currentTime - lastOperationTimes[operationType] < OPERATION_DEBOUNCE_MS) {
      return true
    }
    lastOperationTimes[operationType] = currentTime
    return false
  }

  /**
   * Select components and wires from given elements
   */
  function selectElements(elements) {
    clearSelection()

    // Select components
    elements.components.forEach(component => {
      selection.selectedComponents.value.add(component.id)
    })

    // Select wires
    elements.wires.forEach(wire => {
      const circuit = activeCircuit.value
      if (circuit) {
        const wireIndex = circuit.wires.findIndex(w => w.id === wire.id)
        if (wireIndex !== -1) {
          selection.selectedWires.value.add(wireIndex)
        }
      }
    })
  }

  /**
   * Get selected circuit elements for clipboard operations
   */
  function getSelectedElements() {
    const circuit = activeCircuit.value
    if (!circuit) return { components: [], wires: [], junctions: [] }

    // Get selected components
    const selectedComponents = circuit.components.filter(comp =>
      selection.selectedComponents.value.has(comp.id)
    )

    // Get selected wires
    const selectedWires = Array.from(selection.selectedWires.value)
      .map(index => circuit.wires[index])
      .filter(wire => wire) // Filter out undefined wires

    // Get junctions associated with selected wires
    const selectedWireIds = new Set(selectedWires.map(wire => wire.id))
    const selectedJunctions = circuit.wireJunctions.filter(junction =>
      selectedWireIds.has(junction.connectedWireId)
    )

    return {
      components: selectedComponents,
      wires: selectedWires,
      junctions: selectedJunctions
    }
  }

  /**
   * Copy selected elements to clipboard
   */
  async function copySelected() {
    const selectedElements = getSelectedElements()

    if (selectedElements.components.length === 0 && selectedElements.wires.length === 0) {
      console.warn('No elements selected for copy')
      return false
    }

    try {
      clipboardController.copyToClipboard(selectedElements)

      // Also copy to OS clipboard as JSON
      const osClipboardData = clipboardController.getClipboardDataForOS()
      if (osClipboardData) {
        await copyToOSClipboard(osClipboardData)
      }

      // User feedback
      const stats = clipboardController.getClipboardStats()
      console.log(`Copied ${stats.components} components and ${stats.wires} wires to clipboard`)

      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  /**
   * Cut selected elements to clipboard
   */
  async function cutSelected() {
    const selectedElements = getSelectedElements()

    if (selectedElements.components.length === 0 && selectedElements.wires.length === 0) {
      console.warn('No elements selected for cut')
      return false
    }

    try {
      // Copy to clipboard
      clipboardController.cutToClipboard(selectedElements)

      // Remove selected elements
      deleteSelectedElements()

      // Also copy to OS clipboard as JSON
      const osClipboardData = clipboardController.getClipboardDataForOS()
      if (osClipboardData) {
        await copyToOSClipboard(osClipboardData)
      }

      // User feedback
      const stats = clipboardController.getClipboardStats()
      console.log(`Cut ${stats.components} components and ${stats.wires} wires to clipboard`)

      return true
    } catch (error) {
      console.error('Failed to cut to clipboard:', error)
      return false
    }
  }

  /**
   * Paste elements from clipboard
   */
  async function pasteFromClipboard() {
    // Debounce to prevent duplicate paste operations
    if (shouldDebounceOperation('paste')) {
      return false
    }

    // Save state before paste so it can be undone
    undoCallbacks.pushSnapshot?.()

    if (!clipboardController.hasClipboardData.value) {
      // Try to get data from OS clipboard
      const osData = await getFromOSClipboard()
      if (osData) {
        if (!clipboardController.setClipboardDataFromOS(osData)) {
          console.warn('No valid clipboard data available')
          return false
        }
      } else {
        console.warn('No clipboard data available')
        return false
      }
    }

    try {
      // Calculate paste position (vertically below selected components)
      const pastePosition = calculateNewComponentPosition()

      // Paste elements
      const pastedElements = clipboardController.pasteFromClipboard(pastePosition)

      if (!pastedElements) {
        console.warn('Failed to paste from clipboard')
        return false
      }

      // Add pasted components to the circuit
      pastedElements.components.forEach(component => {
        circuitManager.addComponent(component)
      })

      // Add pasted wires to the circuit
      pastedElements.wires.forEach(wire => {
        circuitManager.addWire(wire)
      })

      // Add pasted junctions to the circuit
      if (pastedElements.junctions) {
        const circuit = activeCircuit.value
        if (circuit && circuit.wireJunctions) {
          pastedElements.junctions.forEach(junction => {
            circuit.wireJunctions.push(junction)
          })
        }
      }

      // Update selection to show pasted elements
      selectElements(pastedElements)

      return true
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return false
    }
  }

  /**
   * Duplicate selected elements
   */
  function duplicateSelected() {
    // Debounce to prevent duplicate operations
    if (shouldDebounceOperation('duplicate')) {
      return false
    }

    // Save state before duplication so it can be undone
    undoCallbacks.pushSnapshot?.()

    const selectedElements = getSelectedElements()

    if (selectedElements.components.length === 0 && selectedElements.wires.length === 0) {
      console.warn('No elements selected for duplicate')
      return false
    }

    try {
      // Calculate duplicate position (vertically below selected components)
      const duplicatePosition = calculateNewComponentPosition(selectedElements)

      // Serialize and deserialize to create copies
      const serializedData = clipboardController.serializeElements(selectedElements)
      const duplicatedElements = clipboardController.deserializeElements(
        serializedData,
        duplicatePosition
      )

      // Add duplicated components to the circuit
      duplicatedElements.components.forEach(component => {
        circuitManager.addComponent(component)
      })

      // Add duplicated wires to the circuit
      duplicatedElements.wires.forEach(wire => {
        circuitManager.addWire(wire)
      })

      // Add duplicated junctions to the circuit
      if (duplicatedElements.junctions) {
        const circuit = activeCircuit.value
        if (circuit && circuit.wireJunctions) {
          duplicatedElements.junctions.forEach(junction => {
            circuit.wireJunctions.push(junction)
          })
        }
      }

      // Update selection to show duplicated elements
      selectElements(duplicatedElements)

      return true
    } catch (error) {
      console.error('Failed to duplicate selection:', error)
      return false
    }
  }

  /**
   * Delete selected elements
   */
  function deleteSelectedElements() {
    const selectedElements = getSelectedElements()

    if (selectedElements.components.length === 0 && selectedElements.wires.length === 0) {
      return false
    }

    // Save state before deletion so it can be undone
    undoCallbacks.pushSnapshot?.()

    try {
      // Delete selected components
      selectedElements.components.forEach(component => {
        circuitManager.removeComponent(component.id)
      })

      // Get the indices and IDs of wires to be deleted
      const circuit = activeCircuit.value
      const deletedWireIds = []
      const deletedWireIndices = []

      selectedElements.wires.forEach(wire => {
        if (wire && wire.id) {
          deletedWireIds.push(wire.id)
          const index = circuit.wires.findIndex(w => w.id === wire.id)
          if (index !== -1) {
            deletedWireIndices.push(index)
          }
        } else {
          console.warn(`Wire has no ID:`, wire)
        }
      })

      // Delete selected wires
      deletedWireIds.forEach(wireId => {
        circuitManager.removeWire(wireId)
      })

      // Clean up junctions associated with deleted wires
      if (circuit && circuit.wireJunctions && deletedWireIds.length > 0) {
        const junctionsToRemove = []

        circuit.wireJunctions.forEach((junction, index) => {
          // Remove junctions that were created from deleted wires
          const isSourceDeleted = deletedWireIndices.includes(junction.sourceWireIndex)
          // Remove junctions that connect to deleted wires
          const isConnectedDeleted = deletedWireIds.includes(junction.connectedWireId)

          if (isSourceDeleted || isConnectedDeleted) {
            junctionsToRemove.push(index)
          }
        })

        // Remove junctions in reverse order to avoid index shifting
        junctionsToRemove
          .sort((a, b) => b - a)
          .forEach(index => {
            circuit.wireJunctions.splice(index, 1)
          })
      }

      // Clear selection after deletion
      clearSelection()

      return true
    } catch (error) {
      console.error('Failed to delete selection:', error)
      return false
    }
  }

  /**
   * Calculate position for new components (paste/duplicate)
   * Places components vertically below selected components with no horizontal offset
   * Returns absolute coordinates where the top-left of the pasted selection should appear
   */
  function calculateNewComponentPosition(sourceElements = null) {
    // If we have selected components, position relative to the selection
    if (selection.selectedComponents.value.size > 0) {
      const circuit = activeCircuit.value
      if (circuit) {
        const selectedComponents = circuit.components.filter(comp =>
          selection.selectedComponents.value.has(comp.id)
        )

        if (selectedComponents.length > 0) {
          // Calculate bounds of selected components
          const bounds = clipboardController.calculateBounds(selectedComponents, [])

          // Position directly below the selection with 3 grid units spacing
          return {
            x: bounds.minX, // Keep horizontal alignment with selection
            y: bounds.maxY + 3 // Position below selection
          }
        }
      }
    }

    // If we have source elements (for duplicate), calculate offset based on their bounds
    if (sourceElements) {
      const bounds = clipboardController.calculateBounds(
        sourceElements.components,
        sourceElements.wires || []
      )

      // Position directly below the original elements with 3 grid units spacing
      return {
        x: bounds.minX, // Keep horizontal alignment
        y: bounds.maxY + 3 // Position below
      }
    }

    // Fallback to using last component position
    return {
      x: lastComponentPosition.value.x,
      y: lastComponentPosition.value.y + 3
    }
  }

  /**
   * Copy data to OS clipboard
   */
  async function copyToOSClipboard(data) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data)
        return true
      } else {
        // Fallback for older browsers
        return copyToClipboardFallback(data)
      }
    } catch (error) {
      console.warn('Failed to copy to OS clipboard:', error)
      return copyToClipboardFallback(data)
    }
  }

  /**
   * Get data from OS clipboard
   */
  async function getFromOSClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText()
      }
    } catch (error) {
      console.warn('Failed to read from OS clipboard:', error)
    }
    return null
  }

  /**
   * Fallback clipboard copy using execCommand
   */
  function copyToClipboardFallback(data) {
    const textarea = document.createElement('textarea')
    textarea.value = data
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    } catch (error) {
      console.error('Fallback clipboard copy failed:', error)
      document.body.removeChild(textarea)
      return false
    }
  }

  /**
   * Handle canvas click events
   */
  function handleCanvasClick(event) {
    // Ignore clicks if we just finished selecting
    if (checkAndClearJustFinished()) {
      return
    }

    const target = event.target

    // Check if we clicked on a connection point
    if (target.classList.contains('connection-point')) {
      const componentId = target.dataset.componentId
      const portIndex = parseInt(target.dataset.port)
      const portType = target.dataset.type // 'input' or 'output'
      const pos = getMousePos(event)

      if (!drawingWire.value) {
        // Clear selection when starting to draw a wire
        clearSelection()
        // Start drawing a wire (pos is in pixels, which is what startWireDrawing expects)
        startWireDrawing(componentId, portIndex, portType, pos)
      } else {
        // Complete the wire if clicking on a compatible connection
        completeWire(componentId, portIndex, portType)
      }
      return
    }

    // If drawing a wire and clicked elsewhere, add a waypoint
    if (drawingWire.value) {
      const pos = getMousePos(event) // Use pixel coordinates for waypoint calculation
      addWireWaypoint(pos)
      return
    }

    // Otherwise, clicking on canvas deselects all
    if (target === event.currentTarget) {
      clearSelection()
    }
  }

  /**
   * Handle canvas mouse down events
   */
  function handleCanvasMouseDown(event) {
    // Only start selection on the canvas itself, not on components
    if (event.target === event.currentTarget && !drawingWire.value) {
      const pos = getMousePos(event)
      const clearExisting = !event.shiftKey && !event.metaKey && !event.ctrlKey
      selection.startSelection(pos, clearExisting)
      event.preventDefault()
    }
  }

  /**
   * Handle mouse move events
   */
  function handleMouseMove(event) {
    // Always update current mouse position for wire preview
    const pos = getMousePos(event)
    wireManagement.currentMousePos.value = pixelToGrid(pos) // Convert to grid units for wire system

    // Track which wire is being hovered for junction mode
    const target = event.target
    if (target && target.classList.contains('wire-segment')) {
      const wireElement = target.closest('[data-wire-index]')
      if (wireElement) {
        lastHoveredWireIndex = parseInt(wireElement.dataset.wireIndex)
      }
    } else {
      lastHoveredWireIndex = null
    }

    // Handle junction preview when Alt is held
    if (isJunctionMode.value) {
      updateJunctionPreview(event, pos) // Use pixel coordinates for junction finding
      connectionPreview.value = null // Clear connection preview in junction mode
    } else {
      junctionPreview.value = null

      // Handle connection preview when drawing a wire
      if (drawingWire.value) {
        updateConnectionPreview(event, pos) // Use pixel coordinates for connection finding
      } else {
        connectionPreview.value = null
      }
    }

    // Handle rubber-band selection
    if (selection.isSelecting.value) {
      selection.updateSelectionEnd(pos)
      return
    }

    // Handle dragging. Shift locks the move to the dominant axis (live — checked each move).
    if (isDragging()) {
      // Snapshot the pre-move state on the FIRST move of a drag, not at mousedown. A plain
      // click-to-select never reaches here, so it no longer pushes a redundant snapshot that
      // would make undo "do nothing" and then over-shoot. updateDrag sets hasMoved, so this
      // fires exactly once per drag, while the components are still at their original positions.
      if (!dragAndDrop.dragging.value?.hasMoved) {
        undoCallbacks.pushSnapshot?.()
      }
      updateDrag(pos, { axisLock: event.shiftKey })
    }
  }

  /**
   * Handle mouse up events
   */
  function handleMouseUp() {
    // End dragging
    if (isDragging()) {
      const wasComponentDrag = !dragAndDrop.dragging.value?.isWireDrag
      const moved = endDrag(snapToGrid)
      if (moved) {
        // A drag that actually moved something is an edit; mark dirty so the save-on-quit
        // prompt is reliable (drag-move otherwise bypasses the circuitManager mutators).
        circuitManager.markCircuitAsModified(circuitManager.activeTabId.value)
      } else if (wasComponentDrag) {
        // A no-move click on certain components acts on them while the sim runs (both callbacks
        // self-gate on isRunning, so a click when stopped just leaves the component selected):
        // a Manual clock advances one edge; a 1-bit Input toggles its value between 0 and 1.
        const sel = selection.selectedComponents.value
        if (sel.size === 1) {
          const clicked = activeCircuit.value?.components.find(c => c.id === [...sel][0])
          if (clicked?.type === 'clock' && clicked.props?.mode === 'manual') {
            undoCallbacks.stepClock?.()
          } else if (clicked?.type === 'input' && (clicked.props?.bits ?? 1) === 1) {
            undoCallbacks.toggleInput?.(clicked)
          }
        }
      }

      // Update last component position if we were dragging components
      if (wasComponentDrag && selection.selectedComponents.value.size > 0) {
        // Use the position of any selected component as the new reference
        const selectedId = Array.from(selection.selectedComponents.value)[0]
        const selectedComponent = activeCircuit.value?.components.find(c => c.id === selectedId)
        if (selectedComponent) {
          updateLastComponentPosition(selectedComponent.x, selectedComponent.y)
        }
      }
    }

    // End rubber-band selection
    if (selection.isSelecting.value) {
      selection.endSelection()
    }
  }

  /**
   * Handle key down events
   */
  function handleKeyDown(event) {
    // Handle Alt key for junction mode
    if (event.altKey && !isJunctionMode.value) {
      isJunctionMode.value = true
      updatePreviewsOnModeChange()
    }

    // Check if an input field is focused
    const activeElement = document.activeElement
    const isInputFocused =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.classList.contains('p-inputtext') ||
        activeElement.classList.contains('p-inputnumber-input'))

    // Only handle keyboard shortcuts if not typing in an input
    if (!isInputFocused) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      // Undo
      if (isCtrlOrCmd && event.key === 'z') {
        event.preventDefault()
        undoCallbacks.undo?.()
        return
      }

      // Clipboard operations
      if (isCtrlOrCmd && event.key === 'c') {
        event.preventDefault()
        copySelected()
        return
      }

      if (isCtrlOrCmd && event.key === 'x') {
        event.preventDefault()
        cutSelected()
        return
      }

      if (isCtrlOrCmd && event.key === 'v') {
        event.preventDefault()
        pasteFromClipboard()
        return
      }

      if (isCtrlOrCmd && event.key === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }

      // Delete selected components and wires
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelectedElements()
        return
      }

      // Arrow-key nudge: move the selection by whole grid cells (Shift = a larger step). Wires
      // follow/stretch via the same connected-move logic as dragging.
      const NUDGE = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }
      }
      if (NUDGE[event.key] && !drawingWire.value) {
        const hasSelection =
          selection.selectedComponents.value.size > 0 || selection.selectedWires.value.size > 0
        if (!hasSelection) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const dir = NUDGE[event.key]
        undoCallbacks.pushSnapshot?.()
        if (nudgeSelection({ x: dir.x * step, y: dir.y * step })) {
          circuitManager.markCircuitAsModified(circuitManager.activeTabId.value)
        }
        return
      }
    }

    // Escape cancels an in-progress wire drawing or drag (restoring pre-drag positions).
    if (event.key === 'Escape') {
      if (drawingWire.value) {
        cancelWireDrawing()
      } else if (isDragging()) {
        cancelDrag()
      }
    }
  }

  /**
   * Handle key up events
   */
  function handleKeyUp(event) {
    // Handle Alt key for junction mode
    if (!event.altKey && isJunctionMode.value) {
      isJunctionMode.value = false
      updatePreviewsOnModeChange()
    }
  }

  // Reset junction mode when window loses focus to prevent stuck alt key state
  function handleWindowBlur() {
    if (isJunctionMode.value) {
      isJunctionMode.value = false
      updatePreviewsOnModeChange()
    }
  }

  /**
   * Get center point between two touches
   */
  function getTouchCenter(touch1, touch2) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  /**
   * Get distance between two touches
   */
  function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Handle touch start events
   */
  function handleTouchStart(event) {
    activeTouches = Array.from(event.touches)

    if (activeTouches.length === 2) {
      // Two-finger gesture - start panning
      event.preventDefault()
      isPanning.value = true

      const touch1 = activeTouches[0]
      const touch2 = activeTouches[1]

      lastPanPosition = getTouchCenter(touch1, touch2)
      lastTouchDistance = getTouchDistance(touch1, touch2)
    }
  }

  /**
   * Handle touch move events
   */
  function handleTouchMove(event) {
    if (activeTouches.length === 2 && isPanning.value) {
      event.preventDefault()

      const touch1 = event.touches[0]
      const touch2 = event.touches[1]

      const currentCenter = getTouchCenter(touch1, touch2)

      if (lastPanPosition) {
        // Calculate pan delta
        const deltaX = currentCenter.x - lastPanPosition.x
        const deltaY = currentCenter.y - lastPanPosition.y

        // Update pan position
        panX.value += deltaX
        panY.value += deltaY
      }

      lastPanPosition = currentCenter
    }
  }

  /**
   * Handle touch end events
   */
  function handleTouchEnd(event) {
    activeTouches = Array.from(event.touches)

    if (activeTouches.length < 2) {
      // End panning when less than 2 fingers
      isPanning.value = false
      lastPanPosition = null
      lastTouchDistance = null
    }
  }

  /**
   * Update junction preview
   */
  function updateJunctionPreview(event, mousePos) {
    // Check if hovering over a wire
    const target = event.target
    if (target && target.classList.contains('wire-segment')) {
      // Find which wire is being hovered
      const wireElement = target.closest('[data-wire-index]')
      if (wireElement) {
        const wireIndex = parseInt(wireElement.dataset.wireIndex)
        const junctionPos = wireManagement.findClosestGridPointOnWire(wireIndex, mousePos)
        if (junctionPos) {
          junctionPreview.value = junctionPos // Already in grid units
          return
        }
      }
    }

    // If not hovering over a wire, clear preview
    junctionPreview.value = null
  }

  /**
   * Update connection preview
   */
  function updateConnectionPreview(event, mousePos) {
    // Check if hovering over a connection point
    const target = event.target
    if (target && target.classList.contains('connection-point')) {
      const componentId = target.dataset.componentId
      const portIndex = parseInt(target.dataset.port)
      const portType = target.dataset.type

      // Check if this is a valid connection (different port type than what we started with)
      if (
        wireManagement.startConnection.value &&
        wireManagement.startConnection.value.portType !== portType
      ) {
        // Find the component to get the connection position
        const component = activeCircuit.value?.components.find(c => c.id === componentId)
        if (component) {
          const connections = getComponentConnections(component)

          const connectionPoint =
            portType === 'output'
              ? connections.outputs?.[portIndex]
              : connections.inputs?.[portIndex]

          if (connectionPoint) {
            // Convert grid coordinates to pixels for rendering
            const gridPosition = {
              x: component.x + connectionPoint.x,
              y: component.y + connectionPoint.y
            }
            connectionPreview.value = gridToPixel(gridPosition)
            return
          }
        }
      }
    }

    // If not hovering over a valid connection point, clear preview
    connectionPreview.value = null
  }

  /**
   * Update previews when junction mode changes while mouse is stationary
   */
  function updatePreviewsOnModeChange() {
    if (wireManagement.currentMousePos.value) {
      if (isJunctionMode.value && lastHoveredWireIndex !== null) {
        // Convert grid coordinates back to pixels for junction finding
        const pixelPos = gridToPixel(wireManagement.currentMousePos.value)
        const junctionPos = wireManagement.findClosestGridPointOnWire(
          lastHoveredWireIndex,
          pixelPos
        )
        if (junctionPos) {
          junctionPreview.value = junctionPos // Already in grid units
        }
        connectionPreview.value = null
      } else {
        junctionPreview.value = null
        connectionPreview.value = null
      }
    }
  }

  /**
   * Handle wire click events
   */
  function handleWireClick(index, event) {
    // If we're drawing a wire and Alt is held, complete it with a junction
    if (drawingWire.value && event.altKey) {
      const pos = getMousePos(event) // Use pixel coordinates for junction finding
      const junctionPos = wireManagement.findClosestGridPointOnWire(index, pos)

      if (junctionPos) {
        // Complete the wire at this junction
        wireManagement.completeWireAtJunction(index, junctionPos)
      }
    }
    // If not drawing and Alt is held, start from junction
    else if (!drawingWire.value && event.altKey) {
      const pos = getMousePos(event) // Use pixel coordinates for junction finding
      const junctionPos = wireManagement.findClosestGridPointOnWire(index, pos)

      if (junctionPos) {
        // Start drawing a new wire from this junction
        wireManagement.startWireFromJunction(index, junctionPos)
      }
    } else {
      // Normal selection behavior with Command/Ctrl for multi-select
      const isMultiSelect = event.metaKey || event.ctrlKey
      selection.selectWire(index, isMultiSelect)
    }
    // Stop propagation to prevent canvas click handler
    event.stopPropagation()
  }

  /**
   * Handle wire mouse down events
   */
  function handleWireMouseDown(wireIndex, event) {
    // Skip drag behavior if Alt is held (junction mode)
    if (event.altKey || isJunctionMode.value) {
      return // Let the click handler deal with junction creation
    }

    // Only start drag if the wire is selected
    if (!selection.selectedWires.value.has(wireIndex)) return

    event.stopPropagation()

    // Get mouse position
    const pos = getMousePos(event)
    const wire = activeCircuit.value?.wires[wireIndex]
    if (!wire || wire.points.length === 0) return

    dragAndDrop.startWireDrag(wireIndex, {
      id: `wire_drag_${wireIndex}`,
      offsetX: pos.x - wire.points[0].x * GRID_SIZE,
      offsetY: pos.y - wire.points[0].y * GRID_SIZE
    })
  }

  /**
   * Add component at smart position with selection handling
   */
  function addComponentAtSmartPositionWithSelection(type, customProps = {}) {
    const newComponent = addComponentAtSmartPosition(type, customProps)

    if (newComponent) {
      // Clear existing selection and select the new component
      clearSelection()
      selectComponent(newComponent.id)
    }

    return newComponent
  }

  return {
    // State
    lastComponentPosition,
    isJunctionMode,
    junctionPreview,
    connectionPreview,

    // Event handlers
    handleCanvasClick,
    handleCanvasMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    handleKeyUp,
    handleWindowBlur,
    handleWireClick,
    handleWireMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,

    // Component operations
    addComponentAtSmartPosition: addComponentAtSmartPositionWithSelection,

    // Clipboard operations
    copySelected,
    cutSelected,
    pasteFromClipboard,
    duplicateSelected,

    // Delete operations
    deleteSelectedElements,

    // Controllers for external access
    clipboardController
  }
}
