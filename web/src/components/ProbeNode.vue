<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on input point -->
    <g :transform="`rotate(${rotation}, 0, 0)`">
      <!-- Value display (above the circle, centered on component) — '?' until the circuit
           has run and a real value has arrived over the wire (see formattedValue). -->
      <text
        :x="(GRID_SIZE + 5) / 2"
        y="-15"
        text-anchor="middle"
        :class="['output-value', { 'value-updated': valueChanged }]"
      >
        {{ formattedValue }}
      </text>

      <!-- Probe body: an unfilled circle (like a gate body) rather than Output's solid dot,
           so a Probe reads as an observer tapped onto the circuit, not a terminal. -->
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

      <!-- Label to the right ("_" renders the tail as a subscript, e.g. PROBE_0) -->
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
  name: 'ProbeNode',
  props: {
    ...draggableProps,
    label: { type: String, default: 'PROBE' },
    // null until the engine has ever reported a value for this probe (unwired, or the
    // circuit hasn't run yet). A string when it comes from the engine (exact 64-bit);
    // formattedValue parses with BigInt so a value above 2**53 still renders correctly.
    value: { type: [Number, String], default: null },
    base: { type: Number, default: 10 },
    bits: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    lastUpdate: { type: Number, default: 0 }
  },
  emits: ['startDrag'],
  computed: {
    formattedValue() {
      if (this.value === null || this.value === undefined) return '?'

      let val
      try {
        val = BigInt(this.value)
      } catch {
        return String(this.value)
      }

      // A single-bit probe reads like Digital's: H(igh)/L(ow), not 1/0.
      if (this.bits === 1) {
        return val === 0n ? 'L' : 'H'
      }

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
      }
      return val.toString()
    }
  },
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth, componentClasses } =
      useComponentView(props, emit)

    // Flash the value text briefly whenever a fresh reading comes in, same as OutputNode.
    const valueChanged = ref(false)
    let changeTimeout = null

    watch([() => props.value, () => props.lastUpdate], () => {
      valueChanged.value = true
      if (changeTimeout) clearTimeout(changeTimeout)
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
</style>
