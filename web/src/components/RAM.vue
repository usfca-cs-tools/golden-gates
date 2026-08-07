<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- RAM body (rectangle) -->
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
    <!-- A (address) input -->
    <text
      :x="inputLabelX"
      :y="aInputY"
      text-anchor="start"
      dominant-baseline="middle"
      class="port-label"
      font-size="10"
    >
      A
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

    <!-- Din (data input) -->
    <text
      :x="inputLabelX"
      :y="dinInputY"
      text-anchor="start"
      dominant-baseline="middle"
      class="port-label"
      font-size="10"
    >
      Din
    </text>
    <circle
      :cx="0"
      :cy="dinInputY"
      :r="CONNECTION_DOT_RADIUS"
      :fill="COLORS.connectionFill"
      class="connection-point input"
      :data-component-id="id"
      data-port="1"
      data-type="input"
    />

    <!-- ld (load) input -->
    <text
      :x="inputLabelX"
      :y="ldInputY"
      text-anchor="start"
      dominant-baseline="middle"
      class="port-label"
      font-size="10"
    >
      ld
    </text>
    <circle
      :cx="0"
      :cy="ldInputY"
      :r="CONNECTION_DOT_RADIUS"
      :fill="COLORS.connectionFill"
      class="connection-point input"
      :data-component-id="id"
      data-port="2"
      data-type="input"
    />

    <!-- st (store) input -->
    <text
      :x="inputLabelX"
      :y="stInputY"
      text-anchor="start"
      dominant-baseline="middle"
      class="port-label"
      font-size="10"
    >
      st
    </text>
    <circle
      :cx="0"
      :cy="stInputY"
      :r="CONNECTION_DOT_RADIUS"
      :fill="COLORS.connectionFill"
      class="connection-point input"
      :data-component-id="id"
      data-port="3"
      data-type="input"
    />

    <!-- CLK (clock) input -->
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
      data-port="4"
      data-type="input"
    />

    <!-- D (data) output label and connection point -->
    <text
      :x="outputLabelX"
      :y="dOutputY"
      text-anchor="end"
      dominant-baseline="middle"
      class="port-label"
      font-size="10"
    >
      D
    </text>
    <circle
      :cx="width * GRID_SIZE"
      :cy="dOutputY"
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
      :y="GRID_SIZE"
      text-anchor="middle"
      dominant-baseline="middle"
      class="component-label"
      font-size="12"
    >
      {{ label }}
    </text>
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'RAM',
  props: {
    ...draggableProps,
    // RAM props
    addressBits: {
      type: Number,
      default: 4,
      validator: (value: number) => value >= 1 && value <= 16
    },
    dataBits: {
      type: Number,
      default: 8,
      validator: (value: number) => value >= 1 && value <= 64
    },
    data: {
      type: Array,
      default: () => []
    },
    label: {
      type: String,
      default: 'RAM'
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
    // Dynamic size based on address bits - larger than ROM to accommodate more inputs
    width() {
      return Math.max(5, Math.ceil(this.addressBits / 2) + 1)
    },
    height() {
      return Math.max(7, Math.ceil(this.addressBits / 2) + 3) // Extra height for more inputs
    },
    // Input positions (left side, spaced on grid vertices)
    aInputY() {
      return GRID_SIZE * 1 // 1 grid unit from top
    },
    dinInputY() {
      return GRID_SIZE * 2 // 2 grid units from top
    },
    ldInputY() {
      return GRID_SIZE * 3 // 3 grid units from top
    },
    stInputY() {
      return GRID_SIZE * 4 // 4 grid units from top
    },
    clkInputY() {
      return GRID_SIZE * 5 // 5 grid units from top
    },
    // Output position (right side, center, on grid vertex)
    dOutputY() {
      return GRID_SIZE * Math.floor(this.height / 2) // Center, snapped to grid
    },
    // Label positions
    inputLabelX() {
      return GRID_SIZE * 0.5 // Inside left edge
    },
    outputLabelX() {
      return GRID_SIZE * (this.width - 0.5) // Inside right edge
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

/* RAM-specific styles - component and port labels use centralized styles from components.css */
</style>
