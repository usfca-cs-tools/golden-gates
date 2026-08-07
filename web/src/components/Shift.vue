<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <g :transform="rotationTransform">
      <!-- Shift body (rectangle) -->
      <rect
        :x="0"
        :y="0"
        :width="width * GRID_SIZE"
        :height="height * GRID_SIZE"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="componentClasses"
        @mousedown="handleMouseDown"
      />

      <!-- Input labels and connection points -->
      <!-- in input (top) -->
      <text
        :x="inputLabelX"
        :y="inInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        in
      </text>
      <circle
        :cx="0"
        :cy="inInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="0"
        data-type="input"
      />

      <!-- shift input (bottom) -->
      <text
        :x="inputLabelX"
        :y="shiftInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        shift
      </text>
      <circle
        :cx="0"
        :cy="shiftInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="1"
        data-type="input"
      />

      <!-- Output labels and connection points -->
      <!-- out output (center) -->
      <text
        :x="outputLabelX"
        :y="outOutputY"
        text-anchor="end"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        out
      </text>
      <circle
        :cx="width * GRID_SIZE"
        :cy="outOutputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="0"
        data-type="output"
      />

      <!-- Component label -->
      <text
        v-if="label"
        :x="(width * GRID_SIZE) / 2"
        :y="(height * GRID_SIZE) / 2"
        text-anchor="middle"
        dominant-baseline="middle"
        class="component-label"
        font-size="12"
      >
        {{ label }}
      </text>
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'Shift',
  props: {
    ...draggableProps,
    // Shift props
    bits: {
      type: Number,
      default: 8,
      validator: (value: number) => value >= 1 && value <= 64
    },
    label: {
      type: String,
      default: '<<'
    },
    mode: {
      type: String,
      default: 'logical_left',
      validator: (value: string) =>
        ['logical_left', 'logical_right', 'arithmetic_right'].includes(value)
    },
    rotation: {
      type: Number,
      default: 0,
      validator: (value: number) => [0, 90, 180, 270].includes(value)
    }
  },
  emits: ['startDrag'],
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth, componentClasses } =
      useComponentView(props, emit)

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      componentClasses,
      COLORS,
      CONNECTION_DOT_RADIUS,
      GRID_SIZE
    }
  },
  computed: {
    // Fixed size - 4x4 grid units (2 inputs, 1 output)
    width() {
      return 4
    },
    height() {
      return 4
    },
    // Input positions (left side, evenly spaced, on grid vertices)
    inInputY() {
      return GRID_SIZE * 1 // 1 grid unit from top
    },
    shiftInputY() {
      return GRID_SIZE * 3 // 3 grid units from top
    },
    // Output position (right side, center, on grid vertex)
    outOutputY() {
      return GRID_SIZE * 2 // 2 grid units from top (center)
    },
    // Label positions
    inputLabelX() {
      return GRID_SIZE * 0.5 // Inside left edge
    },
    outputLabelX() {
      return GRID_SIZE * (this.width - 0.5) // Inside right edge
    },
    rotationTransform() {
      if (this.rotation === 0) return ''
      const centerX = (this.width * GRID_SIZE) / 2
      const centerY = (this.height * GRID_SIZE) / 2
      return `rotate(${this.rotation} ${centerX} ${centerY})`
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

/* Shift-specific styles */
.component-symbol {
  fill: currentColor;
  user-select: none;
  pointer-events: none;
}
</style>
