<template>
  <div
    class="circuit-canvas-container"
    ref="container"
    :class="{ dragging: isDragging() || isSelecting }"
  >
    <!-- Error notifications -->
    <div class="error-notifications">
      <Message
        v-for="notification in errorNotifications"
        :key="notification.id"
        :severity="notification.severity || 'error'"
        :closable="true"
        @close="removeNotification(notification.id)"
        class="error-notification"
        icon=" "
      >
        <template #messageicon>
          <!-- Empty template to hide the icon -->
        </template>
        <div style="padding-left: 12px">{{ notification.message }}</div>
      </Message>
    </div>

    <!-- Scrollable canvas container -->
    <div class="canvas-scroll-container" ref="scrollContainer">
      <!-- Grid background - large grid that covers entire scrollable area -->
      <svg
        class="grid-canvas"
        :width="Math.max(canvasWidth, 10000)"
        :height="Math.max(canvasHeight, 10000)"
      >
        <defs>
          <pattern
            id="grid"
            :width="gridSize * zoom"
            :height="gridSize * zoom"
            patternUnits="userSpaceOnUse"
          >
            <rect
              :x="gridSize * zoom - dotSize * zoom / 2"
              :y="gridSize * zoom - dotSize * zoom / 2"
              :width="dotSize * zoom"
              :height="dotSize * zoom"
              :fill="actualGridDotColor"
            />
          </pattern>
        </defs>
        <!-- Rect that always covers entire SVG area -->
        <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <!-- Circuit elements -->
      <svg
        class="circuit-canvas"
        :class="{
          dragging: isDragging() || isSelecting,
          'wire-drawing': drawingWire,
          'junction-mode': isJunctionMode
        }"
        :width="Math.max(canvasWidth, 10000)"
        :height="Math.max(canvasHeight, 10000)"
        @click="handleCanvasClick"
        @mousedown="onCanvasMouseDown"
        @mousemove="onCanvasMouseMove"
        @mouseup="handleMouseUp"
        @keydown="handleKeyDown"
        @keyup="handleKeyUp"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        tabindex="0"
        ref="canvasSvg"
      >
        <g :transform="`translate(${panX}, ${panY}) scale(${zoom})`">
          <!-- Wires -->
          <Wire
            v-for="(wire, index) in wires"
            :key="`wire-${index}`"
            :points="wire.points"
            :selected="selectedWires.has(index)"
            :step-active="wire.stepActive || false"
            :step-style="wire.stepStyle || 'processing'"
            :value="wire.value ?? null"
            :bits="wire.bits || 1"
            :data-wire-index="index"
            @click="handleWireClick(index, $event)"
            @mousedown="handleWireMouseDown(index, $event)"
            @value-hover="showWireValueTooltip"
            @value-hover-end="hideWireValueTooltip"
          />

          <!-- Wire preview during drawing -->
          <Wire
            v-if="drawingWire && wirePoints.length > 0"
            :points="previewPoints"
            :preview="true"
          />

          <!-- Junction points -->
          <circle
            v-for="(junction, index) in wireJunctions"
            :key="`junction-${index}`"
            :cx="gridToPixel(junction.pos).x"
            :cy="gridToPixel(junction.pos).y"
            :r="CONNECTION_DOT_RADIUS"
            :fill="COLORS.connectionFill"
            class="wire-junction"
            pointer-events="none"
          />

          <!-- Junction preview point when Alt is held -->
          <circle
            v-if="junctionPreview"
            :cx="gridToPixel(junctionPreview).x"
            :cy="gridToPixel(junctionPreview).y"
            :r="CONNECTION_DOT_RADIUS + 2"
            fill="#3b82f6"
            stroke="white"
            stroke-width="2"
            class="junction-preview"
            pointer-events="none"
          >
            <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
          </circle>

          <!-- Connection preview point when hovering during wire drawing -->
          <circle
            v-if="connectionPreview"
            :cx="connectionPreview.x"
            :cy="connectionPreview.y"
            :r="CONNECTION_DOT_RADIUS + 2"
            fill="#3b82f6"
            stroke="white"
            stroke-width="2"
            class="connection-preview"
            pointer-events="none"
          >
            <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
          </circle>

          <!-- Components -->
          <component
            v-for="comp in components"
            :key="comp.id"
            :ref="el => setComponentRef(comp.id, el)"
            :is="getComponentType(comp.type)"
            :id="comp.id"
            :x="comp.x"
            :y="comp.y"
            :selected="selectedComponents.has(comp.id)"
            :circuitManager="comp.type === 'schematic-component' ? circuitManager : undefined"
            v-bind="comp.props"
            @startDrag="handleStartDrag"
            @editSubcircuit="handleEditSubcircuit"
          />

          <!-- Rubber-band selection rectangle -->
          <rect
            v-if="isSelecting && selectionRect"
            :x="selectionRect.x"
            :y="selectionRect.y"
            :width="selectionRect.width"
            :height="selectionRect.height"
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgb(59, 130, 246)"
            stroke-width="1"
            stroke-dasharray="4 2"
            pointer-events="none"
          />
        </g>
      </svg>
    </div>

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button class="zoom-button" @click="zoomIn" :disabled="zoom >= maxZoom" title="Zoom In">
        <i class="pi pi-plus"></i>
      </button>
      <button class="zoom-button" @click="zoomOut" :disabled="zoom <= minZoom" title="Zoom Out">
        <i class="pi pi-minus"></i>
      </button>
    </div>

    <!-- Bus-value hover tooltip (issue #133): follows the cursor over a multi-bit wire -->
    <div
      v-if="wireValueTooltip.visible"
      class="wire-value-tooltip"
      :style="{ left: `${wireValueTooltip.x + 14}px`, top: `${wireValueTooltip.y + 14}px` }"
    >
      {{ wireValueTooltip.text }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, getCurrentInstance } from 'vue'

// Simple debounce utility
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func.apply(this, args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}
import { componentRegistry } from '../utils/componentRegistry'
import { DOT_SIZE, COLORS, CONNECTION_DOT_RADIUS, gridToPixel } from '../utils/constants'
import Wire from './Wire.vue'

// Composables
import { useCanvasViewport } from '../composables/useCanvasViewport'
import { useWireController } from '../composables/useWireController'
import { useSelectionController } from '../composables/useSelectionController'
import { useDragController } from '../composables/useDragController'
import { useCanvasController } from '../composables/useCanvasController'
import { useUndoHistory } from '../composables/useUndoHistory'

export default {
  name: 'CircuitCanvas',
  components: {
    Wire
  },
  props: {
    circuitManager: {
      type: Object,
      required: true
    },
    autosave: {
      type: Object,
      required: false,
      default: null
    }
  },
  emits: ['selectionChanged', 'editSubcircuit'],
  setup(props, { emit }) {
    const container = ref(null)
    const scrollContainer = ref(null)
    const componentRefs = ref({})

    // The focusable SVG. focusCanvas() lets the parent hand keyboard focus back to the
    // canvas (e.g. after editing a property in the inspector — issue #132) so single-key
    // shortcuts like R/T work again instead of typing into the input.
    const canvasSvg = ref(null)
    const focusCanvas = () => {
      // preventScroll so focusing the large SVG never jumps the scroll position.
      canvasSvg.value?.focus({ preventScroll: true })
    }

    // Bus-value hover tooltip (issue #133): shown at the cursor while hovering a multi-bit
    // wire. Wire.vue emits the already-formatted text + viewport point; we position a
    // fixed overlay there so pan/zoom transforms don't affect it.
    const wireValueTooltip = ref({ visible: false, text: '', x: 0, y: 0 })
    const showWireValueTooltip = ({ text, x, y }) => {
      wireValueTooltip.value = { visible: true, text, x, y }
    }
    const hideWireValueTooltip = () => {
      wireValueTooltip.value = { ...wireValueTooltip.value, visible: false }
    }

    // Undo history — snapshot-based, max 50 entries
    const undoHistory = useUndoHistory(props.circuitManager)

    // Canvas operations
    const {
      containerWidth,
      containerHeight,
      canvasWidth,
      canvasHeight,
      gridSize,
      zoom,
      minZoom,
      maxZoom,
      panX,
      panY,
      isPanning,
      zoomIn,
      zoomOut,
      snapToGrid,
      getMousePos,
      setupResizeObserver,
      updateCanvasDimensions
    } = useCanvasViewport()

    // Use the passed circuit manager instead of creating our own
    const {
      activeCircuit,
      addComponent: addComponentBase,
      removeComponent: removeComponentBase,
      updateComponent: updateComponentBase,
      clearCurrentCircuit: clearCurrentCircuitBase,
      navigateToCircuit
    } = props.circuitManager

    // Wrap circuit modification functions with autosaves
    const addComponent = component => {
      if (props.autosave) {
        props.autosave.immediateAutosave()
      }
      return addComponentBase(component)
    }

    const removeComponent = componentId => {
      if (props.autosave) {
        props.autosave.immediateAutosave()
      }
      return removeComponentBase(componentId)
    }

    const updateComponent = (componentId, updates) => {
      if (props.autosave) {
        props.autosave.immediateAutosave()
      }
      return updateComponentBase(componentId, updates)
    }

    const clearCurrentCircuit = () => {
      if (props.autosave) {
        props.autosave.immediateAutosave()
      }
      return clearCurrentCircuitBase()
    }

    // Use current circuit components and wires directly
    const components = computed(() => activeCircuit.value?.components || [])
    const wires = computed(() => activeCircuit.value?.wires || [])
    const wireJunctions = computed(() => activeCircuit.value?.wireJunctions || [])

    // Error notifications
    const errorNotifications = ref([])
    let notificationIdCounter = 0

    // Wire management - pass the shared model functions
    const wireManagement = useWireController(
      components,
      gridSize.value,
      {
        wires: wires,
        wireJunctions: wireJunctions,
        addWire: wire => {
          undoHistory.pushSnapshot()
          if (props.autosave) {
            props.autosave.immediateAutosave()
          }
          const circuit = props.circuitManager.getCircuit(props.circuitManager.activeTabId.value)
          if (circuit?.wires) {
            circuit.wires.push(wire)
            // Wire drawing bypasses the circuitManager mutators, so mark dirty here — the
            // save-on-quit prompt relies on hasUnsavedChanges being reliable (data integrity).
            props.circuitManager.markCircuitAsModified(props.circuitManager.activeTabId.value)
          }
        },
        removeWire: index => {
          if (props.autosave) {
            props.autosave.immediateAutosave()
          }
          const circuit = props.circuitManager.getCircuit(props.circuitManager.activeTabId.value)
          if (circuit?.wires) {
            circuit.wires.splice(index, 1)
            props.circuitManager.markCircuitAsModified(props.circuitManager.activeTabId.value)
          }
        },
        addWireJunction: junction => {
          const circuit = props.circuitManager.getCircuit(props.circuitManager.activeTabId.value)
          if (circuit?.wireJunctions) {
            circuit.wireJunctions.push(junction)
            props.circuitManager.markCircuitAsModified(props.circuitManager.activeTabId.value)
          }
        },
        removeWireJunction: index => {
          const circuit = props.circuitManager.getCircuit(props.circuitManager.activeTabId.value)
          if (circuit?.wireJunctions) {
            circuit.wireJunctions.splice(index, 1)
            props.circuitManager.markCircuitAsModified(props.circuitManager.activeTabId.value)
          }
        }
      },
      props.circuitManager
    )
    const {
      selectedWires,
      drawingWire,
      wirePoints,
      currentMousePos,
      previewPoints,
      startConnection,
      startWireDrawing,
      addWireWaypoint,
      completeWire,
      cancelWireDrawing,
      findClosestGridPointOnWire,
      startWireFromJunction,
      completeWireAtJunction
    } = wireManagement

    // Selection management
    const selection = useSelectionController(
      components,
      wires,
      wireManagement.cleanupJunctionsForDeletedWires,
      componentIds => {
        // Delete components via circuit manager
        componentIds.forEach(id => removeComponent(id))
      },
      index => {
        // Delete wires via circuit manager - access raw circuit data
        const circuit = props.circuitManager.getCircuit(props.circuitManager.activeTabId.value)
        if (circuit?.wires) {
          circuit.wires.splice(index, 1)
          props.circuitManager.markCircuitAsModified(props.circuitManager.activeTabId.value)
        }
      }
    )
    const {
      selectedComponents,
      isSelecting,
      selectionRect,
      startSelection,
      updateSelectionEnd,
      endSelection,
      selectComponent,
      selectWire,
      clearSelection,
      deleteSelected,
      checkAndClearJustFinished
    } = selection

    // Note: selectedWires is managed by both wireManagement and selection composables
    // We use selection.selectedWires for component selection logic

    // Drag and drop
    const dragAndDrop = useDragController(
      components,
      wires,
      selectedComponents,
      selection.selectedWires,
      snapToGrid,
      wireJunctions
    )
    const { dragging, startDrag, startWireDrag, updateDrag, endDrag, isDragging } = dragAndDrop

    // Canvas interactions (controller layer) - must come after selection and dragAndDrop
    const canvasInteractions = useCanvasController(
      props.circuitManager,
      { getMousePos, snapToGrid, gridSize, panX, panY, isPanning },
      wireManagement,
      selection,
      dragAndDrop,
      { pushSnapshot: () => undoHistory.pushSnapshot(), undo: () => undoHistory.undo() }
    )

    const {
      lastComponentPosition,
      isJunctionMode,
      junctionPreview,
      connectionPreview,
      handleCanvasClick,
      handleCanvasMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleKeyDown: handleInteractionKeyDown,
      handleKeyUp: handleInteractionKeyUp,
      handleWindowBlur,
      handleWireClick,
      handleWireMouseDown,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      addComponentAtSmartPosition
    } = canvasInteractions

    // Clicking empty canvas starts a selection box and calls preventDefault() on the
    // mousedown, which suppresses the browser's native focus-on-click of the SVG — so
    // keyboard focus would stay stuck in an inspector input (e.g. Circuit Name/Label).
    // Focus the canvas explicitly so a canvas click reliably returns focus (issue #132),
    // matching what already happens when clicking on a component.
    const onCanvasMouseDown = event => {
      handleCanvasMouseDown(event)
      focusCanvas()
    }

    // Insert a component at the center of the currently-visible canvas, cascading slightly on
    // repeated inserts so they don't stack exactly. Deliberately does NOT scroll the viewport —
    // the new component appears in view without the canvas jumping (which was disorienting).
    const lastInsertGrid = ref(null)
    const insertComponentInView = (type, customProps = {}) => {
      undoHistory.pushSnapshot()
      const newComponent = addComponentAtSmartPosition(type, customProps)
      if (newComponent && scrollContainer.value) {
        const sc = scrollContainer.value
        const g = gridSize.value
        const visible = v =>
          v &&
          v.x * g >= sc.scrollLeft &&
          v.x * g <= sc.scrollLeft + sc.clientWidth &&
          v.y * g >= sc.scrollTop &&
          v.y * g <= sc.scrollTop + sc.clientHeight

        let px = Math.round((sc.scrollLeft + sc.clientWidth / 2) / g)
        let py = Math.round((sc.scrollTop + sc.clientHeight / 2) / g)
        const prev = lastInsertGrid.value
        if (visible(prev) && visible({ x: prev.x + 2, y: prev.y + 2 })) {
          px = prev.x + 2
          py = prev.y + 2
        }

        // Mutate the component in the reactive array (find() returns the proxy) so the move sticks.
        const placed = components.value.find(c => c.id === newComponent.id)
        if (placed) {
          placed.x = px
          placed.y = py
        }
        newComponent.x = px
        newComponent.y = py
        lastInsertGrid.value = { x: px, y: py }
      }
      return newComponent
    }

    // --- Autoscroll while dragging items past the viewport edge (issue #3) ---
    // When a drag reaches the visible edge, scroll the canvas and keep the drag following the
    // cursor: the cursor stays put, we scroll under it, and re-running the drag with the same
    // client point yields a further-out canvas coordinate (getMousePos uses the SVG's CTM).
    let autoScrollFrame = null
    let lastDragPoint = null // { clientX, clientY, svg }

    function dragScrollVelocity(clientX, clientY) {
      const sc = scrollContainer.value
      if (!sc) return { vx: 0, vy: 0 }
      const r = sc.getBoundingClientRect()
      const zone = 48 // px from an edge where autoscroll engages
      const maxSpeed = 24 // px/frame at the very edge
      const speed = dist => Math.max(0, Math.min(1, (zone - dist) / zone)) * maxSpeed
      let vx = 0
      let vy = 0
      if (clientX < r.left + zone) vx = -speed(clientX - r.left)
      else if (clientX > r.right - zone) vx = speed(r.right - clientX)
      if (clientY < r.top + zone) vy = -speed(clientY - r.top)
      else if (clientY > r.bottom - zone) vy = speed(r.bottom - clientY)
      return { vx, vy }
    }

    function autoScrollStep() {
      autoScrollFrame = null
      const sc = scrollContainer.value
      if (!sc || !isDragging() || !lastDragPoint) return
      const { vx, vy } = dragScrollVelocity(lastDragPoint.clientX, lastDragPoint.clientY)
      if (vx === 0 && vy === 0) return
      sc.scrollLeft = Math.max(0, sc.scrollLeft + vx)
      sc.scrollTop = Math.max(0, sc.scrollTop + vy)
      // Cursor is held in place; the canvas just scrolled under it, so re-running the drag moves
      // the items to follow. Synthesize a minimal event with the SVG as target for getMousePos.
      handleMouseMove({
        clientX: lastDragPoint.clientX,
        clientY: lastDragPoint.clientY,
        currentTarget: lastDragPoint.svg,
        target: lastDragPoint.svg
      })
      autoScrollFrame = requestAnimationFrame(autoScrollStep)
    }

    function stopAutoScroll() {
      lastDragPoint = null
      if (autoScrollFrame !== null) {
        cancelAnimationFrame(autoScrollFrame)
        autoScrollFrame = null
      }
    }

    // Wraps the canvas mousemove: run the normal handler, then drive autoscroll during a drag.
    const onCanvasMouseMove = event => {
      handleMouseMove(event)
      if (isDragging()) {
        lastDragPoint = { clientX: event.clientX, clientY: event.clientY, svg: event.currentTarget }
        const { vx, vy } = dragScrollVelocity(event.clientX, event.clientY)
        if ((vx !== 0 || vy !== 0) && autoScrollFrame === null) {
          autoScrollFrame = requestAnimationFrame(autoScrollStep)
        }
      } else {
        stopAutoScroll()
      }
    }

    // Global key handlers for when canvas doesn't have focus
    onMounted(() => {
      const handleGlobalKeyDown = event => {
        handleInteractionKeyDown(event)
      }

      const handleGlobalKeyUp = event => {
        handleInteractionKeyUp(event)
      }

      window.addEventListener('keydown', handleGlobalKeyDown)
      window.addEventListener('keyup', handleGlobalKeyUp)
      window.addEventListener('blur', handleWindowBlur)

      onUnmounted(() => {
        window.removeEventListener('keydown', handleGlobalKeyDown)
        window.removeEventListener('keyup', handleGlobalKeyUp)
        window.removeEventListener('blur', handleWindowBlur)
        stopAutoScroll()
      })
    })

    // Constants
    const dotSize = ref(DOT_SIZE)

    // Set up resize observer
    setupResizeObserver(container)

    // Methods
    function getComponentType(type) {
      return componentRegistry[type]?.component
    }

    function setComponentRef(id, el) {
      if (el) {
        componentRefs.value[id] = el
      } else {
        delete componentRefs.value[id]
      }
    }

    function handleStartDrag(dragInfo) {
      undoHistory.pushSnapshot()
      startDrag(dragInfo)
    }

    function handleEditSubcircuit(circuitId) {
      emit('editSubcircuit', circuitId)
    }

    // Computed property to get component instances
    const componentInstances = computed(() => {
      const instances = {}
      Object.keys(componentRefs.value).forEach(id => {
        const ref = componentRefs.value[id]
        if (ref) {
          instances[id] = ref
        }
      })

      return instances
    })

    // Watch for selection changes and emit event
    watch(
      [selectedComponents, selection.selectedWires],
      () => {
        emit('selectionChanged', {
          components: selectedComponents.value,
          wires: selection.selectedWires.value
        })
      },
      { deep: true }
    )

    // Watch for dragging state and manage body class
    watch(
      () => isDragging() || isSelecting,
      isDraggingOrSelecting => {
        if (isDraggingOrSelecting) {
          document.body.classList.add('dragging-mode')
        } else {
          document.body.classList.remove('dragging-mode')
        }
      },
      { immediate: true }
    )

    // Watch for circuit element changes and update canvas dimensions
    watch(
      [components, wires, wireJunctions],
      () => {
        updateCanvasDimensions(components.value, wires.value, wireJunctions.value)
      },
      { deep: true, immediate: true }
    )

    // Save and restore scroll position
    const SCROLL_POSITION_KEY = 'golden-gates-scroll-position'

    function saveScrollPosition() {
      if (scrollContainer.value) {
        const scrollData = {
          scrollLeft: scrollContainer.value.scrollLeft,
          scrollTop: scrollContainer.value.scrollTop,
          timestamp: Date.now()
        }
        localStorage.setItem(SCROLL_POSITION_KEY, JSON.stringify(scrollData))
      }
    }

    function restoreScrollPosition() {
      try {
        const savedData = localStorage.getItem(SCROLL_POSITION_KEY)
        if (savedData && scrollContainer.value) {
          const { scrollLeft, scrollTop } = JSON.parse(savedData)
          scrollContainer.value.scrollLeft = scrollLeft
          scrollContainer.value.scrollTop = scrollTop
        }
      } catch (error) {
        console.warn('Failed to restore scroll position:', error)
      }
    }

    // Debounced scroll position saving
    const debouncedSaveScroll = debounce(saveScrollPosition, 500)

    onMounted(() => {
      // Restore scroll position after canvas is ready
      setTimeout(restoreScrollPosition, 100)

      // Save scroll position when user scrolls
      if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', debouncedSaveScroll)

        // Cleanup on unmount
        onUnmounted(() => {
          if (scrollContainer.value) {
            scrollContainer.value.removeEventListener('scroll', debouncedSaveScroll)
          }
          // Clean up body class
          document.body.classList.remove('dragging-mode')
        })
      }
    })

    // Add wire directly (for loading from file)
    function addWire(wireData) {
      if (props.autosave) {
        props.autosave.immediateAutosave()
      }
      activeCircuit.value?.wires.push(wireData)
    }

    // Add wire junction directly (for loading from file)
    function addWireJunction(junctionData) {
      if (props.autosave) {
        props.autosave.immediateAutosave()
      }
      activeCircuit.value?.wireJunctions.push(junctionData)
    }

    // Notification management. Same toast stack for errors and positive/info messages;
    // `severity` (PrimeVue Message) drives the color.
    function showNotification(message, severity = 'error') {
      const notification = {
        id: ++notificationIdCounter,
        message,
        severity
      }
      errorNotifications.value.push(notification)

      // Auto-dismiss after 10 seconds
      window.setTimeout(() => {
        removeNotification(notification.id)
      }, 10000)
    }

    function showErrorNotification(message) {
      showNotification(message, 'error')
    }

    function showInfoNotification(message) {
      showNotification(message, 'success')
    }

    function clearAllNotifications() {
      errorNotifications.value = []
    }

    function removeNotification(notificationId) {
      const index = errorNotifications.value.findIndex(n => n.id === notificationId)
      if (index !== -1) {
        errorNotifications.value.splice(index, 1)
      }
    }

    // Load component directly from saved data (preserves ID and props)
    function loadComponent(componentData) {
      // Directly add the component without calling onCreate or generating new ID
      const component = {
        id: componentData.id,
        type: componentData.type,
        x: componentData.x,
        y: componentData.y,
        props: componentData.props || {}
      }
      addComponent(component)
    }

    // Clear current circuit
    function clearCircuit() {
      undoHistory.pushSnapshot()
      clearCurrentCircuit()
      clearSelection()
    }

    // Set loading state (for external control during circuit loading - prevents autosave)
    function setLoadingState(loading) {
      if (props.autosave) {
        props.autosave.setLoadingState(loading)
      }
    }

    // Computed property to get the actual grid dot color
    const actualGridDotColor = computed(() => {
      if (typeof document !== 'undefined') {
        const computedStyle = getComputedStyle(document.documentElement)
        const color = computedStyle.getPropertyValue('--color-grid-dot').trim()
        return color || '#94a3b8'
      }
      return '#94a3b8'
    })

    return {
      // Template refs
      container,
      scrollContainer,
      canvasSvg,
      focusCanvas,

      // Bus-value hover tooltip (issue #133)
      wireValueTooltip,
      showWireValueTooltip,
      hideWireValueTooltip,

      // State
      containerWidth,
      containerHeight,
      canvasWidth,
      canvasHeight,
      gridSize,
      zoom,
      minZoom,
      maxZoom,
      panX,
      panY,
      isPanning,
      dotSize,
      components,
      wires,
      selectedComponents,
      selectedWires: selection.selectedWires,
      isSelecting,
      selectionRect,
      drawingWire,
      wirePoints,
      previewPoints,
      wireJunctions,
      isJunctionMode,
      junctionPreview,
      connectionPreview,

      // Hierarchical circuit state
      activeCircuit,

      // Error notifications
      errorNotifications,
      showErrorNotification,
      showInfoNotification,
      removeNotification,
      clearAllNotifications,

      // Constants
      COLORS,
      CONNECTION_DOT_RADIUS,
      gridToPixel,
      actualGridDotColor,

      // Methods
      getComponentType,
      setComponentRef,
      handleCanvasClick,
      handleCanvasMouseDown,
      onCanvasMouseDown,
      handleMouseMove,
      onCanvasMouseMove,
      handleMouseUp,
      handleKeyDown: handleInteractionKeyDown,
      handleKeyUp: handleInteractionKeyUp,
      handleStartDrag,
      handleEditSubcircuit,
      handleWireClick,
      handleWireMouseDown,
      addComponentAtSmartPosition: insertComponentInView,
      clearCircuit,
      setLoadingState,
      updateComponent,
      loadComponent,
      addWire,
      addWireJunction,
      isDragging,
      getMousePos,
      zoomIn,
      zoomOut,

      // Circuit hierarchy methods
      navigateToCircuit,

      // Undo
      undo: () => undoHistory.undo()
    }
  }
}
</script>

<style scoped>
.circuit-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--color-canvas-bg);
  overflow: hidden;
}

/* Bus-value hover tooltip (issue #133). Fixed to the viewport (positioned from the
   cursor's clientX/clientY) so canvas pan/zoom transforms never shift it; never
   intercepts pointer events so it can't flicker the underlying wire's hover. */
.wire-value-tooltip {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  white-space: nowrap;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.canvas-scroll-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.grid-canvas,
.circuit-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.grid-canvas {
  pointer-events: none;
  z-index: 1;
}

.circuit-canvas {
  z-index: 2;
  cursor: default;
  background-color: transparent;
}

.circuit-canvas.dragging {
  cursor: move;
}

/* Prevent text selection globally when dragging or selecting */
.circuit-canvas-container.dragging {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Add global style when dragging to prevent text selection on body */
body {
  transition: user-select 0s;
}

body.dragging-mode {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.zoom-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.zoom-button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-component-fill);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.zoom-button:hover:not(:disabled) {
  background-color: var(--color-component-hover-fill);
  border-color: var(--color-border-medium);
  color: var(--color-text-primary);
}

.zoom-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-button i {
  font-size: 12px;
}

.error-notifications {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 500px;
  width: auto;
}

.error-notification {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 6px;
}

/* Clean styling for error notifications */
.error-notification .p-message-icon {
  display: none !important;
}
</style>
