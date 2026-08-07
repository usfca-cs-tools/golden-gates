<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <g :transform="rotationTransform">
      <!-- Multiply body (rectangle) -->
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
      <!-- a input (top) -->
      <text
        :x="inputLabelX"
        :y="aInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        a
      </text>
      <circle
        :cx="0"
        :cy="aInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="0"
        data-type="input"
      />

      <!-- b input (bottom) -->
      <text
        :x="inputLabelX"
        :y="bInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        b
      </text>
      <circle
        :cx="0"
        :cy="bInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="1"
        data-type="input"
      />

      <!-- Output labels and connection points -->
      <!-- mul output (center) -->
      <text
        :x="outputLabelX"
        :y="mulOutputY"
        text-anchor="end"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        mul
      </text>
      <circle
        :cx="width * GRID_SIZE"
        :cy="mulOutputY"
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
  name: 'Multiply',
  props: {
    ...draggableProps,
    // Multiply props
    bits: {
      type: Number,
      default: 8,
      validator: (value: number) => value >= 1 && value <= 64
    },
    label: {
      type: String,
      default: '×'
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
    // Fixed size - 4x4 grid units (smaller than Adder since only 2 inputs, 1 output)
    width() {
      return 4
    },
    height() {
      return 4
    },
    // Input positions (left side, evenly spaced, on grid vertices)
    aInputY() {
      return GRID_SIZE * 1 // 1 grid unit from top
    },
    bInputY() {
      return GRID_SIZE * 3 // 3 grid units from top
    },
    // Output position (right side, center, on grid vertex)
    mulOutputY() {
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

/* Multiply-specific styles */
.component-symbol {
  fill: currentColor;
  user-select: none;
  pointer-events: none;
}
</style>
