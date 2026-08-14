<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on output point -->
    <g :transform="`rotate(${rotation}, ${GRID_SIZE}, 0)`">
      <!-- Value display (above the square, centered on component) -->
      <text :x="(GRID_SIZE - 5) / 2" y="-15" text-anchor="middle" class="component-value">
        {{ formattedValue }}
      </text>

      <!-- Label ("_" renders the tail as a subscript, e.g. IW_0) -->
      <text x="-10" y="5" text-anchor="end" font-size="14" class="component-label"
        ><tspan
          v-for="(part, i) in subscriptParts(label)"
          :key="i"
          :font-size="part.subscript ? '0.72em' : null"
          :dy="part.drop ? '0.22em' : null"
          >{{ part.text }}</tspan
        ></text
      >

      <!-- Input square (larger by 5px, offset left so output point is on right edge) -->
      <rect
        x="-5"
        :y="-(GRID_SIZE + 5) / 2"
        :width="GRID_SIZE + 5"
        :height="GRID_SIZE + 5"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="[componentClasses, { 'input-toggleable': bits === 1 }]"
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
import { subscriptParts } from '../utils/labelFormat'

export default defineComponent({
  name: 'InputNode',
  props: {
    ...draggableProps,
    // IO props
    label: { type: String, default: 'IN' },
    // A decimal string for exact 64-bit values (entered via BigInt); Number for legacy/small.
    value: { type: [Number, String], default: 0 },
    base: { type: Number, default: 10 },
    bits: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 }
  },
  emits: ['startDrag'],
  computed: {
    formattedValue() {
      // Parse with BigInt so a value above 2**53 formats exactly.
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

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      componentClasses,
      subscriptParts,
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

/* A 1-bit input is click-to-toggle while the sim runs (0 <-> 1), like the Manual clock.
   The pointer cursor cues that it's interactive. */
.input-toggleable {
  cursor: pointer;
}
</style>
