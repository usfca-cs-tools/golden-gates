<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on input point -->
    <g :transform="`rotate(${rotation}, 0, 0)`">
      <!-- Value display (above the circle, centered on component) -->
      <text
        :x="(GRID_SIZE + 5) / 2"
        y="-15"
        text-anchor="middle"
        :class="['output-value', { 'value-updated': valueChanged }]"
      >
        {{ formattedValue }}
      </text>

      <!-- Output circle (larger by 5px diameter, offset right so input point is on left edge) -->
      <circle
        :cx="(GRID_SIZE + 5) / 2"
        cy="0"
        :r="(GRID_SIZE + 5) / 2"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="componentClasses"
        @mousedown="handleMouseDown"
      />

      <!-- Input connection point (left side, centered - on grid vertex) -->
      <circle
        cx="0"
        cy="0"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="0"
        data-type="input"
      />

      <!-- Label to the right ("_" renders the tail as a subscript, e.g. IW_0) -->
      <text :x="GRID_SIZE + 10" y="5" text-anchor="start" font-size="14" class="component-label"
        ><tspan
          v-for="(part, i) in subscriptParts(label)"
          :key="i"
          :font-size="part.subscript ? '0.72em' : null"
          :dy="part.drop ? '0.22em' : null"
          >{{ part.text }}</tspan
        ></text
      >
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'
import { subscriptParts } from '../utils/labelFormat'

export default defineComponent({
  name: 'OutputNode',
  props: {
    ...draggableProps,
    // IO props
    label: { type: String, default: 'OUT' },
    // A string when it comes from the engine (exact 64-bit); formattedValue parses with BigInt.
    value: { type: [Number, String], default: 0 },
    base: { type: Number, default: 10 },
    bits: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    lastUpdate: { type: Number, default: 0 }
  },
  emits: ['startDrag'],
  computed: {
    formattedValue() {
      // Values arrive from the engine as strings (exact 64-bit); parse with BigInt so a value
      // above 2**53 formats correctly. Guard against a bad value rather than throwing.
      let val
      try {
        val = BigInt(this.value ?? 0)
      } catch {
        return String(this.value ?? '')
      }

      // Format value based on base
      if (this.base === 16) {
        return (
          '0x' +
          val
            .toString(16)
            .padStart(Math.ceil(this.bits / 4), '0')
            .toUpperCase()
        )
      } else if (this.base === 2) {
        return '0b' + val.toString(2).padStart(this.bits, '0')
      } else {
        return val.toString()
      }
    }
  },
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth, componentClasses } =
      useComponentView(props, emit)

    // Track when value updates for animation
    const valueChanged = ref(false)
    let changeTimeout = null

    // Watch for any update (value or forced refresh)
    watch([() => props.value, () => props.lastUpdate], () => {
      valueChanged.value = true

      // Clear any existing timeout
      if (changeTimeout) {
        clearTimeout(changeTimeout)
      }

      // Remove glow after animation completes
      changeTimeout = setTimeout(() => {
        valueChanged.value = false
      }, 1000)
    })

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      componentClasses,
      valueChanged,
      subscriptParts,
      COLORS,
      CONNECTION_DOT_RADIUS,
      GRID_SIZE
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

/* Animation for value updates - SVG compatible */
@keyframes valueUpdate {
  0% {
    fill: #3b82f6;
    transform: scale(1);
    opacity: 1;
  }
  25% {
    fill: #60a5fa;
    transform: scale(1.2);
    opacity: 0.9;
  }
  50% {
    fill: #3b82f6;
    transform: scale(1.1);
    opacity: 0.8;
  }
  75% {
    fill: #60a5fa;
    transform: scale(1.05);
    opacity: 0.9;
  }
  100% {
    fill: #3b82f6;
    transform: scale(1);
    opacity: 1;
  }
}

/* Output-specific styles - value-updated uses centralized styles from components.css */
</style>
