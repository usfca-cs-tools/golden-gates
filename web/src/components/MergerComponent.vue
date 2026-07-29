<template>
  <g
    class="merger-component"
    :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE}) rotate(${rotation})`"
  >
    <!-- Merger body (vertical line with thick stroke) -->
    <line
      :x1="GRID_SIZE"
      :y1="0"
      :x2="GRID_SIZE"
      :y2="height"
      :class="['merger-body', { selected: selected }]"
      :stroke-width="8"
      :data-component-id="id"
      @mousedown="handleMouseDown"
    />

    <!-- Output connection line -->
    <line :x1="GRID_SIZE" :y1="outputY" :x2="2 * GRID_SIZE" :y2="outputY" class="connector-line" />

    <!-- Output bits label positioned to the right and above the output point -->
    <text :x="2 * GRID_SIZE + 8" :y="outputY - 3" class="range-label" text-anchor="start">
      {{ outputBits }}
    </text>

    <!-- Input connection lines with labels -->
    <g v-for="(input, index) in inputs" :key="index">
      <line x1="0" :y1="input.y" :x2="GRID_SIZE" :y2="input.y" class="connector-line" />
      <!-- Range label positioned to the left of the connection point -->
      <text :x="-8" :y="input.y - 3" class="range-label" text-anchor="end">
        {{ getRangeLabel(index) }}
      </text>
    </g>

    <!-- Connection points -->
    <circle
      :cx="2 * GRID_SIZE"
      :cy="outputY"
      :r="CONNECTION_DOT_RADIUS"
      class="connection-point output-point"
      :data-component-id="id"
      :data-port="0"
      data-type="output"
    />

    <circle
      v-for="(input, index) in inputs"
      :key="`input-${index}`"
      cx="0"
      :cy="input.y"
      :r="CONNECTION_DOT_RADIUS"
      class="connection-point input-point"
      :data-component-id="id"
      :data-port="index"
      data-type="input"
    />
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { componentRegistry } from '../utils/componentRegistry'
import { useComponentView } from '../composables/useComponentView'
import { CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'MergerComponent',
  props: {
    // Merger props
    id: { type: String, required: true },
    label: { type: String, default: '' },
    ranges: { type: Array, default: () => [] },
    outputBits: { type: Number, default: 8 },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    selected: { type: Boolean, default: false },
    rotation: { type: Number, default: 0 }
  },
  emits: ['startDrag'],
  computed: {
    // Get dynamic connections for rendering with rotation:0 (base positions); this
    // component's own rotate(rotation) transform spins the dots visually, while
    // getConnections rotates for external consumers — so the two agree, no double spin.
    connections() {
      const config = componentRegistry['merger']
      return config.getConnections({ ...this.$props, rotation: 0 })
    },

    // Get dynamic dimensions
    dimensions() {
      const config = componentRegistry['merger']
      return config.getDimensions(this.$props)
    },

    height() {
      return this.dimensions.height
    },

    outputY() {
      return this.connections.outputs[0].y * GRID_SIZE
    },

    inputs() {
      return this.connections.inputs.map(input => ({
        ...input,
        y: input.y * GRID_SIZE
      }))
    }
  },
  setup(props, { emit }) {
    // Use the draggable composable for selection and dragging
    const { handleMouseDown, fillColor, strokeColor, strokeWidth } = useComponentView(props, emit)

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      CONNECTION_DOT_RADIUS,
      GRID_SIZE
    }
  },
  methods: {
    // Get range label for display
    getRangeLabel(index: number): string {
      const range = this.ranges[index]
      if (!range) return ''

      if (range.start === range.end) {
        return range.start.toString()
      } else {
        return `${range.start}-${range.end}`
      }
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

.merger-component {
  pointer-events: all;
}
</style>
