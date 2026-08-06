// Grid and sizing constants
export const GRID_SIZE = 15
export const DOT_SIZE = 2
export const CONNECTION_DOT_RADIUS = 3

// Vertical distance (in grid units) between adjacent I/O ports on multi-port bodies —
// subcircuits and plexers (mux/decoder/priority-encoder). One grid unit keeps circuits compact
// on small laptop screens. Logic gates deliberately keep their own 2-unit idiom so a centered
// output always lands between two inputs on a vertex (see LogicGate.vue / componentFactory.js).
export const PORT_PITCH = 1

// Coordinate conversion utilities
export function gridToPixel(gridCoord) {
  if (typeof gridCoord === 'number') {
    return gridCoord * GRID_SIZE
  }
  return {
    x: gridCoord.x * GRID_SIZE,
    y: gridCoord.y * GRID_SIZE
  }
}

export function pixelToGrid(pixelCoord) {
  if (typeof pixelCoord === 'number') {
    return Math.round(pixelCoord / GRID_SIZE)
  }
  return {
    x: Math.round(pixelCoord.x / GRID_SIZE),
    y: Math.round(pixelCoord.y / GRID_SIZE)
  }
}

// Colors - using CSS custom properties for automatic light/dark theme switching
export const COLORS = {
  // Component colors
  componentFill: 'var(--color-component-fill)',
  componentStroke: 'var(--color-component-stroke)',
  componentSelectedFill: 'var(--color-component-selected-fill)',
  componentSelectedStroke: 'var(--color-component-selected-stroke)',
  componentHoverFill: 'var(--color-component-hover-fill)',

  // Step highlighting colors
  componentStepFill: 'var(--color-component-step-fill)',
  componentStepStroke: 'var(--color-component-step-stroke)',

  // Error state colors
  componentErrorFill: 'var(--color-component-error-fill)',
  componentErrorStroke: 'var(--color-component-error-stroke)',
  componentWarningFill: 'var(--color-component-warning-fill)',
  componentWarningStroke: 'var(--color-component-warning-stroke)',

  // Connection point colors
  connectionFill: 'var(--color-connection-fill)',
  connectionHoverFill: 'var(--color-connection-hover-fill)',

  // Grid colors
  gridDot: 'var(--color-grid-dot)',
  canvasBackground: 'var(--color-grid-background)',

  // Wire colors
  wire: 'var(--color-wire)',
  wireSelected: 'var(--color-wire-selected)',
  wirePreview: 'var(--color-wire-preview)',
  wireProcessing: 'var(--color-wire-processing)',

  // Component text colors
  componentText: 'var(--color-component-text)'
}

// Stroke widths
export const STROKE_WIDTHS = {
  normal: 2,
  selected: 3,
  step: 3,
  error: 3,
  wire: 2,
  wireSelected: 3
}

// Component dimensions
export const COMPONENT_DIMENSIONS = {
  input: {
    width: GRID_SIZE,
    height: GRID_SIZE
  },
  andGate: {
    width: 60,
    height: 120,
    arcRadius: 30
  }
}
