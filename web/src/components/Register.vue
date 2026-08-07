<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on component -->
    <g :transform="`rotate(${rotation}, ${(width * GRID_SIZE) / 2}, ${(height * GRID_SIZE) / 2})`">
      <!-- Register body (rectangle) -->
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
      <!-- D input -->
      <text
        :x="inputLabelX"
        :y="dInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        D
      </text>
      <circle
        :cx="0"
        :cy="dInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="0"
        data-type="input"
      />

      <!-- CLK input -->
      <text
        :x="inputLabelX"
        :y="clkInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        CLK
      </text>
      <circle
        :cx="0"
        :cy="clkInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="1"
        data-type="input"
      />

      <!-- EN input -->
      <text
        :x="inputLabelX"
        :y="enInputY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        en
      </text>
      <circle
        :cx="0"
        :cy="enInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="2"
        data-type="input"
      />

      <!-- Q output label and connection point -->
      <text
        :x="outputLabelX"
        :y="qOutputY"
        text-anchor="end"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        Q
      </text>
      <circle
        :cx="width * GRID_SIZE"
        :cy="qOutputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="0"
        data-type="output"
      />

      <!-- Component label (positioned above center to avoid overlap with CLK) -->
      <text
        v-if="label"
        :x="(width * GRID_SIZE) / 2"
        :y="GRID_SIZE * 2"
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
  name: 'Register',
  props: {
    ...draggableProps,
    // Register props
    bits: {
      type: Number,
      default: 1,
      validator: (value: number) => value >= 1 && value <= 64
    },
    label: {
      type: String,
      default: 'REG'
    },
    rotation: {
      type: Number,
      default: 0
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
    // Register is 4 grid units wide, 6 grid units tall to properly space inputs
    width() {
      return 4
    },
    height() {
      return 6
    },
    // Input positions (left side, on grid vertices with 2 grid unit spacing)
    dInputY() {
      return GRID_SIZE * 1 // First grid vertex
    },
    clkInputY() {
      return GRID_SIZE * 3 // Third grid vertex (2 units spacing)
    },
    enInputY() {
      return GRID_SIZE * 5 // Fifth grid vertex (2 units spacing)
    },
    // Output position (right side, center)
    qOutputY() {
      return GRID_SIZE * 3 // Center at third grid vertex
    },
    // Label positions
    inputLabelX() {
      return GRID_SIZE * 0.5 // Inside left edge
    },
    outputLabelX() {
      return GRID_SIZE * 3.5 // Inside right edge
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

/* Register-specific styles - component and port labels use centralized styles from components.css */
</style>
