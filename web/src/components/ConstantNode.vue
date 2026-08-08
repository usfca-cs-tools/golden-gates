<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on output point -->
    <g :transform="`rotate(${rotation}, ${GRID_SIZE}, 0)`">
      <!-- Invisible hitbox over the value keeps the shapeless constant draggable
           (.component-value / .component-label are pointer-events:none). -->
      <rect
        :x="GRID_SIZE - 6 - valueWidth"
        y="-9"
        :width="valueWidth + 12"
        height="18"
        fill="transparent"
        class="constant-hitbox"
        @mousedown="handleMouseDown"
      />

      <!-- Label (e.g. C0), above the value -->
      <text
        v-if="label"
        :x="GRID_SIZE - 6"
        y="-13"
        text-anchor="end"
        class="component-label"
        :style="stateStyle"
      >
        {{ label }}
      </text>

      <!-- Value drawn next to the connection point, with no surrounding shape -->
      <text
        :x="GRID_SIZE - 6"
        y="0"
        dominant-baseline="central"
        text-anchor="end"
        class="component-value"
        :style="stateStyle"
      >
        {{ formattedValue }}
      </text>

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
  name: 'ConstantNode',
  props: {
    ...draggableProps,
    // IO props
    label: { type: String, default: 'CONST' },
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

      // Format value based on base (same as Input)
      if (this.base === 16) {
        return '0x' + val.toString(16).padStart(Math.ceil(this.bits / 4), '0').toUpperCase()
      } else if (this.base === 2) {
        return '0b' + val.toString(2).padStart(this.bits, '0')
      } else {
        return val.toString()
      }
    },
    // Approximate pixel width of the value (monospace 12px ≈ 7.2px/char), used to size the
    // invisible drag hitbox so it tracks the number's footprint at any length.
    valueWidth() {
      return Math.max(GRID_SIZE, this.formattedValue.length * 7.2)
    },
    // With no box to color, the text itself carries selection/error state; normal state
    // falls through to the .component-value / .component-label fill.
    stateStyle() {
      if (this.hasError) return { fill: COLORS.componentErrorStroke }
      if (this.hasWarning) return { fill: COLORS.componentWarningStroke }
      if (this.selected) return { fill: COLORS.componentSelectedStroke }
      return {}
    }
  },
  setup(props, { emit }) {
    const { handleMouseDown } = useComponentView(props, emit)

    return {
      handleMouseDown,
      COLORS,
      CONNECTION_DOT_RADIUS,
      GRID_SIZE
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

.constant-hitbox {
  cursor: move;
}
</style>
