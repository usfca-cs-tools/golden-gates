<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <g :transform="rotationTransform">
      <!-- Body (rectangle) -->
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

      <!-- Input 'in' (left), width shown below the label -->
      <text
        :x="GRID_SIZE * 0.5"
        :y="portY"
        text-anchor="start"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        in
      </text>
      <circle
        :cx="0"
        :cy="portY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point input"
        :data-component-id="id"
        data-port="0"
        data-type="input"
      />

      <!-- Output 'out' (right) -->
      <text
        :x="GRID_SIZE * (width - 0.5)"
        :y="portY"
        text-anchor="end"
        dominant-baseline="middle"
        class="port-label"
        font-size="10"
      >
        out
      </text>
      <circle
        :cx="width * GRID_SIZE"
        :cy="portY"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point output"
        :data-component-id="id"
        data-port="0"
        data-type="output"
      />

      <!-- Widths (in -> out), and the user label -->
      <text
        :x="(width * GRID_SIZE) / 2"
        :y="GRID_SIZE * 0.55"
        text-anchor="middle"
        dominant-baseline="middle"
        class="port-label"
        font-size="9"
      >
        {{ inBits }}&#8594;{{ outBits }}
      </text>
      <text
        v-if="label"
        :x="(width * GRID_SIZE) / 2"
        :y="GRID_SIZE * (height - 0.55)"
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
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'SignExtend',
  props: {
    ...draggableProps,
    // Sign extender: sign-extends an inBits-wide input to an outBits-wide output.
    inBits: {
      type: Number,
      default: 8,
      validator: (value: number) => value >= 1 && value <= 64
    },
    outBits: {
      type: Number,
      default: 16,
      validator: (value: number) => value >= 1 && value <= 64
    },
    label: {
      type: String,
      default: 'SE'
    },
    rotation: {
      type: Number,
      default: 0,
      validator: (value: number) => [0, 90, 180, 270].includes(value)
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
    // 4x2 grid units. Even dimensions keep the single in/out ports on integer grid vertices
    // through 90/180/270 rotation (rotation is about the body centre (2,1)).
    width() {
      return 4
    },
    height() {
      return 2
    },
    // Both ports on the centre line (1 grid unit down).
    portY() {
      return GRID_SIZE * 1
    },
    rotationTransform() {
      if (this.rotation === 0) return ''
      const centerX = (this.width * GRID_SIZE) / 2
      const centerY = (this.height * GRID_SIZE) / 2
      return `rotate(${this.rotation} ${centerX} ${centerY})`
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';
</style>
