<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on component -->
    <g :transform="`rotate(${rotation}, ${(width * GRID_SIZE) / 2}, ${rotateCenterY})`">
      <!-- Decoder body (trapezoid - mirror of multiplexer) -->
      <path
        :d="decoderPath"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="componentClasses"
        @mousedown="handleMouseDown"
      />

      <!-- Selector input connection point (no label) -->
      <circle
        :cx="selInputX"
        :cy="selInputY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="0"
        data-type="input"
      />

      <!-- Output connection points (no labels) -->
      <template v-for="(_, index) in numOutputs" :key="`output-${index}`">
        <circle
          :cx="width * GRID_SIZE"
          :cy="getOutputY(index)"
          :r="CONNECTION_DOT_RADIUS"
          :fill="COLORS.connectionFill"
          class="connection-point output"
          :data-component-id="id"
          :data-port="index"
          data-type="output"
        />
      </template>

      <!-- Output 0 label -->
      <text
        :x="width * GRID_SIZE - 8"
        :y="getOutputY(0) + 4"
        text-anchor="middle"
        font-size="10"
        class="component-label"
      >
        0
      </text>

      <!-- Component label (centered) -->
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
import { useSelectorBits } from '../composables/useSelectorBits'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE, PORT_PITCH } from '../utils/constants'

const { selectorBitsProp } = useSelectorBits()

export default defineComponent({
  name: 'Decoder',
  props: {
    ...draggableProps,
    // Decoder props
    ...selectorBitsProp,
    label: {
      type: String,
      default: 'DEC'
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
    // Use shared selector bits computation
    ...useSelectorBits().createSelectorBitsComputed(),

    // Decoder is 2 grid units wide to match multiplexer, height based on number of outputs
    width() {
      return 2
    },
    totalHeight() {
      const { calculatePortBasedHeight } = useSelectorBits()
      return calculatePortBasedHeight(this.numOutputs, PORT_PITCH, 4, 2) // minHeight=4, margin=2
    },
    height() {
      return this.totalHeight
    },
    // Rotate about a whole vertex (odd body heights at PORT_PITCH=1 have a half-vertex midpoint);
    // getConnections rounds identically so drawn dots match computed ports.
    rotateCenterY() {
      return Math.round(this.totalHeight / 2) * GRID_SIZE
    },
    // SVG path for the decoder shape (trapezoid - mirror of multiplexer)
    decoderPath() {
      const w = this.width * GRID_SIZE
      const h = this.totalHeight * GRID_SIZE
      const slant = GRID_SIZE / 2 // How much the diagonal slants inward

      // Decoder shape: narrow on left, wide on right (mirror of multiplexer)
      // Multiplexer has vertical left, diagonal right: M 0 0, L w slant, L w (h-slant), L 0 h
      // Decoder should have diagonal left, vertical right: M 0 slant, L w 0, L w h, L 0 (h-slant)
      return `
        M 0 ${slant}
        L ${w} 0
        L ${w} ${h}
        L 0 ${h - slant}
        Z
      `
    },
    // Selector input position (center, top or bottom based on prop)
    selInputX() {
      return GRID_SIZE * 1 // Center of 2-unit wide component
    },
    selInputY() {
      return this.selectorPosition === 'top' ? 0 : this.totalHeight * GRID_SIZE
    }
  },
  methods: {
    getOutputY(index: number) {
      // Use shared port positioning utility
      const { getPortY } = useSelectorBits()
      return getPortY(index, PORT_PITCH, 1) * GRID_SIZE // PORT_PITCH spacing, 1 margin, to pixels
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

/* Decoder-specific styles - component and port labels use centralized styles from components.css */
</style>
