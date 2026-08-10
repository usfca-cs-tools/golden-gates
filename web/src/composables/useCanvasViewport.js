import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { GRID_SIZE } from '../utils/constants'

// Persist the zoom level so it's remembered across program runs (the desktop app relaunches
// to the same magnification the student left off at). Clamped to the same [0.5, 2] range the
// zoom controls enforce, so a stale/hand-edited value can't wedge the view.
const ZOOM_STORAGE_KEY = 'gg.zoom'
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

function loadPersistedZoom() {
  const stored = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY))
  if (!Number.isFinite(stored)) return 1
  return Math.min(Math.max(stored, ZOOM_MIN), ZOOM_MAX)
}

export function useCanvasViewport() {
  // Container dimensions (viewport size)
  const containerWidth = ref(800)
  const containerHeight = ref(600)

  // Canvas dimensions (content size - can be larger than container)
  const canvasWidth = ref(800)
  const canvasHeight = ref(600)

  // Grid settings
  const gridSize = ref(GRID_SIZE)

  // Zoom settings
  const zoom = ref(loadPersistedZoom())
  const minZoom = ref(ZOOM_MIN)
  const maxZoom = ref(ZOOM_MAX)
  const zoomStep = ref(0.25)

  // Remember the zoom level across runs. Every zoom mutation (zoomIn/zoomOut/resetZoom, or a
  // pinch gesture) flows through this ref, so one watcher covers them all.
  watch(zoom, value => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(value))
    } catch {
      /* ignore storage failures (private mode / quota) — persistence is best-effort */
    }
  })

  // Pan settings for two-finger gesture support
  const panX = ref(0)
  const panY = ref(0)
  const isPanning = ref(false)

  // Calculate dynamic canvas bounds based on circuit elements
  function calculateCanvasBounds(components, wires, wireJunctions, padding = 150) {
    // Start with container dimensions as minimum bounds
    let minX = 0
    let minY = 0
    let maxX = containerWidth.value
    let maxY = containerHeight.value

    // Check component bounds
    if (components && components.length > 0) {
      components.forEach(component => {
        const compMinX = component.x * gridSize.value
        const compMinY = component.y * gridSize.value
        const compMaxX = compMinX + (component.width || 4) * gridSize.value
        const compMaxY = compMinY + (component.height || 4) * gridSize.value

        minX = Math.min(minX, compMinX)
        minY = Math.min(minY, compMinY)
        maxX = Math.max(maxX, compMaxX)
        maxY = Math.max(maxY, compMaxY)
      })
    }

    // Check wire bounds
    if (wires && wires.length > 0) {
      wires.forEach(wire => {
        if (wire.points && wire.points.length > 0) {
          wire.points.forEach(point => {
            const wireX = point.x * gridSize.value
            const wireY = point.y * gridSize.value

            minX = Math.min(minX, wireX)
            minY = Math.min(minY, wireY)
            maxX = Math.max(maxX, wireX)
            maxY = Math.max(maxY, wireY)
          })
        }
      })
    }

    // Check junction bounds
    if (wireJunctions && wireJunctions.length > 0) {
      wireJunctions.forEach(junction => {
        if (junction.pos) {
          const junctionX = junction.pos.x * gridSize.value
          const junctionY = junction.pos.y * gridSize.value

          minX = Math.min(minX, junctionX)
          minY = Math.min(minY, junctionY)
          maxX = Math.max(maxX, junctionX)
          maxY = Math.max(maxY, junctionY)
        }
      })
    }

    // Add padding and ensure minimum size
    const paddedMinX = minX - padding
    const paddedMinY = minY - padding
    const paddedMaxX = maxX + padding
    const paddedMaxY = maxY + padding

    return {
      width: Math.max(containerWidth.value, paddedMaxX - paddedMinX),
      height: Math.max(containerHeight.value, paddedMaxY - paddedMinY)
    }
  }

  // Update canvas dimensions based on content
  function updateCanvasDimensions(components, wires, wireJunctions) {
    const bounds = calculateCanvasBounds(components, wires, wireJunctions)

    // Only update if dimensions actually changed
    if (bounds.width !== canvasWidth.value || bounds.height !== canvasHeight.value) {
      canvasWidth.value = bounds.width
      canvasHeight.value = bounds.height
    }

    return bounds
  }

  // Resize canvas to fit container
  function resizeCanvas(containerRef) {
    if (!containerRef) return

    const container = containerRef
    if (container) {
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight

      // Only update if dimensions actually changed
      if (newWidth !== canvasWidth.value || newHeight !== canvasHeight.value) {
        canvasWidth.value = newWidth
        canvasHeight.value = newHeight
      }
    }
  }

  // Zoom in
  function zoomIn() {
    if (zoom.value < maxZoom.value) {
      zoom.value = Math.min(zoom.value + zoomStep.value, maxZoom.value)
    }
  }

  // Zoom out
  function zoomOut() {
    if (zoom.value > minZoom.value) {
      zoom.value = Math.max(zoom.value - zoomStep.value, minZoom.value)
    }
  }

  // Reset zoom
  function resetZoom() {
    zoom.value = 1
  }

  // Snap position to grid and return pixel coordinates
  function snapToGrid(pos) {
    return {
      x: Math.round(pos.x / gridSize.value) * gridSize.value,
      y: Math.round(pos.y / gridSize.value) * gridSize.value
    }
  }

  // Get mouse position in canvas coordinates
  function getMousePos(event) {
    // Find the SVG element - it might be the currentTarget or we need to traverse up
    let svg = event.currentTarget
    while (svg && svg.tagName !== 'svg') {
      svg = svg.parentElement
    }

    if (!svg || !svg.createSVGPoint) {
      // Fallback: find the nearest SVG element
      svg = event.target.closest('svg')
    }

    if (!svg || !svg.createSVGPoint) {
      console.error('Could not find SVG element')
      return { x: 0, y: 0 }
    }

    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY

    // Transform to SVG coordinates and account for zoom
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())
    return {
      x: svgP.x / zoom.value,
      y: svgP.y / zoom.value
    }
  }

  // Set up resize observer
  function setupResizeObserver(containerRef) {
    let resizeObserver = null
    let resizeHandler = null

    onMounted(() => {
      // Initial resize
      resizeCanvas(containerRef.value)

      // Set up resize observer
      if (window.ResizeObserver && containerRef.value) {
        resizeObserver = new ResizeObserver(() => {
          resizeCanvas(containerRef.value)
        })
        resizeObserver.observe(containerRef.value)
      }

      // Fallback to window resize - store function reference for proper cleanup
      resizeHandler = () => resizeCanvas(containerRef.value)
      window.addEventListener('resize', resizeHandler)
    })

    onUnmounted(() => {
      if (resizeObserver && containerRef.value) {
        resizeObserver.unobserve(containerRef.value)
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
    })
  }

  return {
    // State
    containerWidth,
    containerHeight,
    canvasWidth,
    canvasHeight,
    gridSize,
    zoom,
    minZoom,
    maxZoom,
    zoomStep,
    panX,
    panY,
    isPanning,

    // Methods
    resizeCanvas,
    zoomIn,
    zoomOut,
    resetZoom,
    snapToGrid,
    getMousePos,
    setupResizeObserver,
    updateCanvasDimensions
  }
}
