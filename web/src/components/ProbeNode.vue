<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on the connection point -->
    <g :transform="`rotate(${rotation}, 0, 0)`">
      <!-- Invisible hit area for select/drag. A Probe has no visible body (Digital-style tap:
           just a dot and a value, not a gate/output shape), so this keeps a reasonably sized
           click target without drawing a circle. Drawn before the connection dot so the dot
           still wins the hit-test for starting a wire (see CircuitCanvas's connection-point
           handling). -->
      <circle
        :cx="(GRID_SIZE + 5) / 2"
        cy="0"
        :r="(GRID_SIZE + 5) / 2"
        fill="transparent"
        class="probe-hit-area"
        @mousedown="handleMouseDown"
      />

      <!-- Value display, just above the connection dot (Digital-style) — '?' until the circuit
           has run and a real value has arrived over the wire (see formattedValue). -->
      <text
        x="0"
        y="-10"
        text-anchor="middle"
        :class="['output-value', { 'value-updated': valueChanged }]"
      >
        {{ formattedValue }}
      </text>

      <!-- The connection dot IS the probe: a diagnostic tap on the wire, not a gate/output body,
           so there's no circle drawn around it (unlike Output). With no body left to carry
           selection/error/warning/step state, the dot's own color does that instead. -->
      <circle
        cx="0"
        cy="0"
        :r="CONNECTION_DOT_RADIUS"
        :fill="dotFill"
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
    },
    // With no body circle to carry fill/stroke state (see useComponentView's fillColor), the
    // connection dot itself reflects selection/error/warning/step, in the same priority order
    // as every other component. The *Stroke* colors (rather than the pastel body Fill ones) are
    // used since they're saturated enough to read at dot size.
    dotFill() {
      if (this.hasError) return COLORS.componentErrorStroke
      if (this.hasWarning) return COLORS.componentWarningStroke
      if (this.stepActive) return COLORS.componentStepStroke
      if (this.selected) return COLORS.componentSelectedStroke
      return COLORS.connectionFill
    }
  },
  setup(props, { emit }) {
    const { handleMouseDown } = useComponentView(props, emit)

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
