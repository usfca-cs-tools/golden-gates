<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on output point -->
    <g :transform="`rotate(${rotation}, ${GRID_SIZE}, 0)`">
      <!-- Value display (above the square, centered on component) -->
      <text :x="(GRID_SIZE - 5) / 2" y="-15" text-anchor="middle" class="component-value">
        {{ formattedValue }}
      </text>

      <!-- Label -->
      <text x="-10" y="5" text-anchor="end" font-size="14" class="component-label">
        {{ label }}
      </text>

      <!-- Input square (larger by 5px, offset left so output point is on right edge) -->
      <rect
        x="-5"
        :y="-(GRID_SIZE + 5) / 2"
        :width="GRID_SIZE + 5"
        :height="GRID_SIZE + 5"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="componentClasses"
        @mousedown="handleMouseDown"
      />

      <!-- Output connection point (right side, centered - on grid vertex) -->
      <circle
        :cx="GRID_SIZE"
        cy="0"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="0"
        data-type="output"
      />
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'InputNode',
  props: {
    ...draggableProps,
    // IO props
    label: { type: String, default: 'IN' },
    value: { type: Number, default: 0 },
    base: { type: Number, default: 10 },
    bits: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 }
  },
  emits: ['startDrag'],
  computed: {
    formattedValue() {
      // Handle null/undefined value
      const val = this.value ?? 0

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
  }
  // generate() method will be added back later if needed
})
</script>

<style scoped>
@import '../styles/components.css';
</style>
