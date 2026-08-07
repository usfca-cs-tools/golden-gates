<template>
  <g
    class="splitter-component"
    :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE}) rotate(${rotation})`"
  >
    <!-- Splitter body (vertical line with thick stroke) -->
    <line
      :x1="GRID_SIZE"
      :y1="0"
      :x2="GRID_SIZE"
      :y2="height"
      :class="['splitter-body', { selected, 'has-error': hasError, 'has-warning': hasWarning }]"
      :stroke-width="8"
      :data-component-id="id"
      @mousedown="handleMouseDown"
    />

    <!-- Input connection line -->
    <line x1="0" :y1="inputY" :x2="GRID_SIZE" :y2="inputY" class="connector-line" />

    <!-- Input bits label positioned to the left and above the input point -->
    <text :x="-8" :y="inputY - 3" class="range-label" text-anchor="end">
      {{ inputBits }}
    </text>

    <!-- Output connection lines with labels -->
    <g v-for="(output, index) in outputs" :key="index">
      <line
        :x1="GRID_SIZE"
        :y1="output.y"
        :x2="2 * GRID_SIZE"
        :y2="output.y"
        class="connector-line"
      />
      <!-- Range label positioned to the right of the connection point -->
      <text :x="2 * GRID_SIZE + 8" :y="output.y - 3" class="range-label" text-anchor="start">
        {{ getRangeLabel(index) }}
      </text>
    </g>

    <!-- Connection points -->
    <circle
      cx="0"
      :cy="inputY"
      :r="CONNECTION_DOT_RADIUS"
      class="connection-point input-point"
      :data-component-id="id"
      :data-port="0"
      data-type="input"
    />

    <circle
      v-for="(output, index) in outputs"
      :key="`output-${index}`"
      :cx="2 * GRID_SIZE"
      :cy="output.y"
      :r="CONNECTION_DOT_RADIUS"
      class="connection-point output-point"
      :data-component-id="id"
      :data-port="index"
      data-type="output"
    />
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { componentRegistry } from '../utils/componentRegistry'
import { useComponentView } from '../composables/useComponentView'
import { CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'SplitterComponent',
  props: {
    // Splitter props
    id: { type: String, required: true },
    label: { type: String, default: '' },
    ranges: { type: Array, default: () => [] },
    inputBits: { type: Number, default: 8 },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    selected: { type: Boolean, default: false },
    rotation: { type: Number, default: 0 },
    // Set by the error system when this splitter has a simulation error/warning
    hasError: { type: Boolean, default: false },
    hasWarning: { type: Boolean, default: false }
  },
  emits: ['startDrag'],
  computed: {
    // Get dynamic connections for rendering. Use rotation:0 (base positions) and let
    // this component's own SVG rotate(rotation) transform spin the dots visually —
    // getConnections applies the same rotation for external consumers (wire resolution,
    // serialization), so the two agree without double-rotating.
    connections() {
      const config = componentRegistry['splitter']
      return config.getConnections({ ...this.$props, rotation: 0 })
    },

    // Get dynamic dimensions
    dimensions() {
      const config = componentRegistry['splitter']
      return config.getDimensions(this.$props)
    },

    height() {
      return this.dimensions.height
    },

    inputY() {
      return this.connections.inputs[0].y * GRID_SIZE
    },

    outputs() {
      return this.connections.outputs.map(output => ({
        ...output,
        y: output.y * GRID_SIZE
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

.splitter-component {
  pointer-events: all;
}
</style>
