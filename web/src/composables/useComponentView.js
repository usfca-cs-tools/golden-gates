import { computed } from 'vue'
import { COLORS, STROKE_WIDTHS, GRID_SIZE } from '../utils/constants'

export function useComponentView(props, emit) {
  // Handle mouse down for dragging
  const handleMouseDown = event => {
    // Get the actual position where the user clicked relative to the SVG
    const svg = event.target.closest('svg')
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY

    // Transform to SVG coordinates
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())

    // Get zoom from the transform group if it exists
    const transformGroup = svg.querySelector('g[transform]')
    let zoom = 1
    if (transformGroup) {
      const transform = transformGroup.getAttribute('transform')
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/)
      if (scaleMatch) {
        zoom = parseFloat(scaleMatch[1])
      }
    }

    // Calculate offset from the component's position, accounting for zoom
    // Convert component position from grid units to pixels for calculation
    emit('startDrag', {
      id: props.id,
      offsetX: svgP.x / zoom - props.x * GRID_SIZE,
      offsetY: svgP.y / zoom - props.y * GRID_SIZE,
      event: event
    })
  }

  // Computed styles for selection, step highlighting, and error states
  const fillColor = computed(() => {
    if (props.hasError) return COLORS.componentErrorFill
    if (props.hasWarning) return COLORS.componentWarningFill
    if (props.stepActive) return COLORS.componentStepFill
    if (props.selected) return COLORS.componentSelectedFill
    // Per-definition body color (subcircuit appearance) overrides only the resting fill; the
    // error/warning/step/selected states above still take precedence so status stays legible.
    return props.baseFill || COLORS.componentFill
  })

  const strokeColor = computed(() => {
    if (props.hasError) return COLORS.componentErrorStroke
    if (props.hasWarning) return COLORS.componentWarningStroke
    if (props.stepActive) return COLORS.componentStepStroke
    if (props.selected) return COLORS.componentSelectedStroke
    return COLORS.componentStroke
  })

  const strokeWidth = computed(() => {
    if (props.hasError || props.hasWarning) return STROKE_WIDTHS.error
    if (props.stepActive) return STROKE_WIDTHS.step
    if (props.selected) return STROKE_WIDTHS.selected
    return STROKE_WIDTHS.normal
  })

  // CSS classes for step highlighting and error states
  const componentClasses = computed(() => {
    const classes = ['component-body']
    if (props.stepActive) {
      classes.push('step-active', `step-${props.stepStyle}`)
    }
    if (props.hasError) classes.push('has-error')
    if (props.hasWarning) classes.push('has-warning')
    return classes.join(' ')
  })

  return {
    handleMouseDown,
    fillColor,
    strokeColor,
    strokeWidth,
    componentClasses
  }
}

// Common props for draggable components
export const draggableProps = {
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  id: {
    type: String,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  },
  // Optional resting body fill (e.g. a subcircuit's per-definition color). Null → theme default.
  baseFill: {
    type: String,
    default: null
  },
  // Step highlighting props
  stepActive: {
    type: Boolean,
    default: false
  },
  stepStyle: {
    type: String,
    default: 'processing'
  },
  stepDuration: {
    type: Number,
    default: 500
  },
  // Error state props
  hasError: {
    type: Boolean,
    default: false
  },
  hasWarning: {
    type: Boolean,
    default: false
  },
  // These props are set by the error system but not used by components
  // since we switched to centralized PrimeVue notifications
  errorMessage: {
    type: String,
    default: ''
  },
  errorMessageId: {
    type: String,
    default: ''
  },
  errorDetails: {
    type: Object,
    default: () => ({})
  }
}
