<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on output point -->
    <g :transform="`rotate(${rotation}, ${outputX}, ${outputY})`">
      <!-- Multiplexer body with slanted lines -->
      <path
        :d="multiplexerPath"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        class="component-body"
        @mousedown="handleMouseDown"
      />

      <!-- Input connection points -->
      <circle
        v-for="(_, index) in numInputs"
        :key="`input-${index}`"
        :cx="0"
        :cy="getInputY(index)"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        :data-port="index"
        data-type="input"
      />

      <!-- Selector connection point -->
      <circle
        :cx="selectorX"
        :cy="selectorY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        :data-port="numInputs"
        data-type="input"
      />

      <!-- Output connection point -->
      <circle
        :cx="outputX"
        :cy="outputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="0"
        data-type="output"
      />

      <!-- Label (centered within the multiplexer) -->
      <text
        v-if="label"
        :x="GRID_SIZE"
        :y="outputY"
        text-anchor="middle"
        dominant-baseline="middle"
        class="component-label"
      >
        {{ label }}
      </text>

      <!-- Input 0 label -->
      <text x="8" :y="getInputY(0) + 4" text-anchor="middle" font-size="10" class="component-label">
        0
      </text>
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { useSelectorBits } from '../composables/useSelectorBits'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE, PORT_PITCH } from '../utils/constants'

const { selectorBitsProp } = useSelectorBits()

export default defineComponent({
  name: 'MultiplexerNode',
  props: {
    ...draggableProps,
    // Multiplexer props
    ...selectorBitsProp,
    bits: {
      type: Number,
      default: 1,
      validator: (value: number) => value >= 1 && value <= 64
    },
    label: {
      type: String,
      default: ''
    },
    selectorPosition: {
      type: String,
      default: 'bottom',
      validator: (value: string) => ['top', 'bottom'].includes(value)
    },
    rotation: {
      type: Number,
      default: 0
    }
  },
  emits: ['startDrag'],
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth } = useComponentView(props, emit)

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      COLORS,
      CONNECTION_DOT_RADIUS,
      GRID_SIZE
    }
  },
  computed: {
    // Use shared selector bits computation
    ...useSelectorBits().createSelectorBitsComputed(),

    // Total height to accommodate all inputs on grid vertices
    totalHeight() {
      const { calculatePortBasedHeight } = useSelectorBits()
      return calculatePortBasedHeight(this.numInputs, PORT_PITCH, 4, 2) // minHeight=4, margin=2
    },
    // Multiplexer is 2 grid units wide
    width() {
      return 2
    },
    // SVG path for the multiplexer shape with slanted lines
    multiplexerPath() {
      const w = this.width * GRID_SIZE
      const h = this.totalHeight * GRID_SIZE
      const slant = GRID_SIZE / 2 // How much the top and bottom lines slant inward

      // Proper multiplexer shape: vertical sides, diagonal top and bottom edges
      return `
        M 0 0
        L ${w} ${slant}
        L ${w} ${h - slant}
        L 0 ${h}
        Z
      `
    },
    outputX() {
      return this.width * GRID_SIZE
    },
    outputY() {
      // Snap the output (and thus the rotation center) to a whole vertex. At PORT_PITCH=1 the
      // body height is odd, so the true midpoint would be a half-vertex — unreachable by wires
      // and off-grid under rotation. getConnections rounds identically.
      return Math.round(this.totalHeight / 2) * GRID_SIZE
    },
    selectorX() {
      return (this.width * GRID_SIZE) / 2
    },
    selectorY() {
      return this.selectorPosition === 'top' ? 0 : this.totalHeight * GRID_SIZE
    }
  },
  methods: {
    getInputY(index) {
      // Use shared port positioning utility
      const { getPortY } = useSelectorBits()
      return getPortY(index, PORT_PITCH, 1) * GRID_SIZE // PORT_PITCH spacing, 1 margin, to pixels
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';
</style>
