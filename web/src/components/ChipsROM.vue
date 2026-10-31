<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- CHIPSROM body (rectangle) -->
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

    <!-- sel (select/enable) input -->
    <text
      :x="inputLabelX"
      :y="selInputY"
      text-anchor="start"
      dominant-baseline="middle"
      class="port-label"
      font-size="10"
    >
      sel
    </text>
    <circle
      :cx="0"
      :cy="selInputY"
      :r="CONNECTION_DOT_RADIUS"
      :fill="COLORS.connectionFill"
      class="connection-point input"
      :data-component-id="id"
      data-port="1"
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
      :y="GRID_SIZE * 1.8"
      text-anchor="middle"
      dominant-baseline="middle"
      class="port-label"
      font-size="9"
      opacity="sources.length ? 1 : 0.5"
    >
    <title v-if="sources.length">{{  programNames }}</title>
      {{ programLine }}
    </text>
  </g>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'
import { useI18n } from 'vue-i18n';

export default defineComponent({
  name: 'ChipsROM',
  props: {
    ...draggableProps,
    // ChipsROM props
    addressBits: {
      type: Number,
      default: 6,
      validator: (value: number) => value >= 1 && value <= 16
    },
    sources: {
      type: Array as PropType<Array<{name: string; text: string }>>,
      default: () => [],
    },
    words: {
      type: Array,
      default: () => []
    },
    label: {
      type: String,
      default: 'ChipsROM'
    }
  },
  emits: ['startDrag'],
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth, componentClasses } =
      useComponentView(props, emit)
    const {t} = useI18n()

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      componentClasses,
      COLORS,
      CONNECTION_DOT_RADIUS,
      GRID_SIZE,
      t
    }
  },
  computed: {
    programNames(): string {
        return (this.sources as Array<{ name: string }>).map(s => s.name).join(', ')
    },
    programLine(): string {
        const s = this.sources as Array<{ name: string }>
        if (s.length === 0) return this.t('chipsROM.noProgram')
        const full = s.length > 1 ? this.t('chipsROM.moreFiles', { name: s[0].name, count: s.length - 1 }) : s[0].name
        const maxChars = Math.floor((this.width * GRID_SIZE - 8) / 5.5)
        return full.length > maxChars ? full.slice(0, maxChars - 1) + '…' : full
    },
    // Dynamic size based on address bits (min 4x5 to accommodate 2 grid unit spacing)
    width() {
      return Math.max(4, Math.ceil(this.addressBits / 2))
    },
    height() {
      return Math.max(5, Math.ceil(this.addressBits / 2) + 1)
    },
    // Input positions (left side, spaced 2 grid units apart, on grid vertices)
    aInputY() {
      return GRID_SIZE * 1 // 1 grid unit from top
    },
    selInputY() {
      return GRID_SIZE * 3 // 3 grid units from top (2 units apart)
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

/* ROM-specific styles - component and port labels use centralized styles from components.css */
</style>
