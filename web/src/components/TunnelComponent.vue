<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Label beside the symbol (always upright), on the side opposite the connection so a column
         of tunnels reads cleanly: right at 0°, left at 180°. -->
    <text
      :x="labelAttrs.x"
      :y="labelAttrs.y"
      :text-anchor="labelAttrs.anchor"
      :dominant-baseline="labelAttrs.baseline"
      class="component-label"
    >
      {{ label }}
    </text>

    <!-- Rotation group centered roughly in the middle -->
    <g :transform="`rotate(${rotation}, ${GRID_SIZE}, ${GRID_SIZE})`">
      <!-- Triangle shape -->
      <polygon
        :points="trianglePoints"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="componentClasses"
        @mousedown="handleMouseDown"
      />

      <!-- Single connection dot -->
      <circle
        :cx="0"
        :cy="GRID_SIZE"
        :r="CONNECTION_DOT_RADIUS"
        :fill="COLORS.connectionFill"
        class="connection-point"
        :class="direction"
        :data-component-id="id"
        data-port="0"
        :data-type="direction"
      />
    </g>
  </g>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, CONNECTION_DOT_RADIUS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'TunnelNode',
  props: {
    ...draggableProps,
    label: { type: String, default: 'TUN' },
    rotation: { type: Number, default: 0 },
    direction: { type: String as PropType<'input' | 'output'>, default: 'input' }
  },
  emits: ['startDrag'],
  computed: {
    // The connection dot is at the triangle tip; the label goes beside the flat (base) side,
    // opposite the tip, vertically centred on the connection level. Right at 0°, left at 180°.
    // 90°/270° (vertical tunnels, uncommon) keep the label above.
    labelAttrs() {
      const PAD = 5
      if (this.rotation === 180) {
        // tip/connection on the right, wide part on the left -> label left
        return { x: GRID_SIZE - PAD, y: GRID_SIZE, anchor: 'end', baseline: 'central' }
      }
      if (this.rotation === 90) {
        // tip/connection at the top, wide part at the bottom -> label below the wide part
        return { x: GRID_SIZE, y: GRID_SIZE + PAD + 3, anchor: 'middle', baseline: 'central' }
      }
      if (this.rotation === 270) {
        // tip/connection at the bottom, wide part at the top -> label above the wide part
        return { x: GRID_SIZE, y: GRID_SIZE - PAD - 3, anchor: 'middle', baseline: 'central' }
      }
      // 0° (default): tip/connection on the left, wide part on the right -> label right
      return { x: GRID_SIZE + PAD, y: GRID_SIZE, anchor: 'start', baseline: 'central' }
    },
    trianglePoints() {
      const width = GRID_SIZE
      const height = GRID_SIZE

      const tipX = 0
      const tipY = GRID_SIZE // connection dot is at (0, GRID_SIZE)

      const baseTopX = width
      const baseTopY = GRID_SIZE - height / 2

      const baseBottomX = width
      const baseBottomY = GRID_SIZE + height / 2

      return `${tipX},${tipY} ${baseBottomX},${baseBottomY} ${baseTopX},${baseTopY}`
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
})
</script>

<style scoped>
@import '../styles/components.css';
</style>
