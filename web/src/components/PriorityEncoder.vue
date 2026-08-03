<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on component -->
    <!-- Rotate about x=2 (not the true 1.5 center of a 3-wide body) so ports stay on
         the grid; getConnections uses the same center. -->
    <g :transform="`rotate(${rotation}, ${2 * GRID_SIZE}, ${(height * GRID_SIZE) / 2})`">
      <!-- Priority Encoder body (rectangle) -->
      <rect
        :width="width * GRID_SIZE"
        :height="height * GRID_SIZE"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="componentClasses"
        @mousedown="handleMouseDown"
      />

      <!-- Input connection points -->
      <template v-for="(_, index) in numInputs" :key="`input-${index}`">
        <circle
          :cx="0"
          :cy="getInputY(index)"
          :r="CONNECTION_DOT_RADIUS"
          :fill="COLORS.connectionFill"
          class="connection-point input"
          :data-component-id="id"
          :data-port="index"
          data-type="input"
        />
      </template>

      <!-- Output connection points (inum and any) -->
      <circle
        :cx="width * GRID_SIZE"
        :cy="getInumOutputY()"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="0"
        data-type="output"
      />

      <circle
        :cx="width * GRID_SIZE"
        :cy="getAnyOutputY()"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="1"
        data-type="output"
      />

      <!-- Output labels (right-justified) -->
      <text
        :x="width * GRID_SIZE - 4"
        :y="getInumOutputY() + 4"
        text-anchor="end"
        font-size="10"
        class="component-label"
      >
        inum
      </text>

      <text
        :x="width * GRID_SIZE - 4"
        :y="getAnyOutputY() + 4"
        text-anchor="end"
        font-size="10"
        class="component-label"
      >
        any
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
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

const { selectorBitsProp } = useSelectorBits()

export default defineComponent({
  name: 'PriorityEncoder',
  props: {
    ...draggableProps,
    // Priority Encoder props
    ...selectorBitsProp,
    label: {
      type: String,
      default: 'PE'
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

    // Priority Encoder is 3 grid units wide, height based on number of inputs
    width() {
      return 3
    },
    totalHeight() {
      const { calculatePortBasedHeight } = useSelectorBits()
      return calculatePortBasedHeight(this.numInputs, 2, 6, 2) // inputSpacing=2, minHeight=6, margin=2
    },
    height() {
      return this.totalHeight
    }
  },
  methods: {
    getInputY(index: number) {
      // Use shared port positioning utility
      const { getPortY } = useSelectorBits()
      return getPortY(index, 2, 1) * GRID_SIZE // 2 spacing, 1 margin, convert to pixels
    },
    getInumOutputY() {
      // Place inum output at 1/3 height, rounded to grid
      return Math.round(this.totalHeight / 3) * GRID_SIZE
    },
    getAnyOutputY() {
      // Place any output at 2/3 height, rounded to grid
      return Math.round((this.totalHeight * 2) / 3) * GRID_SIZE
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

/* PriorityEncoder-specific styles - component labels use centralized styles from components.css */
</style>
