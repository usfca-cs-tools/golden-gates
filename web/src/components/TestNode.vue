<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Test box. The background carries the result (green pass / red fail) so it reads at a
         glance; a full truth table only looked good for trivial cases, so it's gone. -->
    <rect
      x="0"
      y="0"
      :width="boxWidth"
      :height="boxHeight"
      :fill="statusFill"
      :stroke="statusStroke"
      :stroke-width="strokeWidth"
      :class="componentClasses"
      rx="3"
      @mousedown="handleMouseDown"
    />

    <!-- Name (left) -->
    <text
      x="8"
      :y="boxHeight / 2 + 4"
      text-anchor="start"
      font-size="12"
      class="component-label"
    >
      {{ label }}
    </text>

    <!-- Result badge (right). Failure DETAIL is surfaced via the shared structured-error path. -->
    <circle
      :cx="boxWidth - GRID_SIZE / 2 - 4"
      :cy="boxHeight / 2"
      :r="GRID_SIZE / 2 - 1"
      :fill="badgeFill"
    />
    <text
      :x="boxWidth - GRID_SIZE / 2 - 4"
      :y="boxHeight / 2 + 4"
      text-anchor="middle"
      font-size="12"
      font-weight="bold"
      fill="#ffffff"
    >
      {{ badgeGlyph }}
    </text>
  </g>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'TestNode',
  props: {
    ...draggableProps,
    label: { type: String, default: 'TEST' },
    // The test's truth table drives the simulation; it's no longer drawn in the component.
    table: {
      type: Object,
      default: () => ({ inputNames: [], outputNames: [], rows: [] })
    },
    // 'pass' | 'fail' | 'pending' (failure detail comes via the error path)
    status: { type: String, default: 'pending' }
  },
  emits: ['startDrag'],
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth, componentClasses } =
      useComponentView(props, emit)

    // Compact box: just the name and the result badge.
    const boxHeight = computed(() => GRID_SIZE * 2)
    const boxWidth = computed(() =>
      Math.max(GRID_SIZE * 4, String(props.label).length * 7.5 + GRID_SIZE * 2.5)
    )

    // The result colors the whole background — pass green, fail the same reddish as a component
    // with a simulation error. Pending keeps the normal component look.
    const statusFill = computed(() => {
      if (props.status === 'pass') return 'var(--color-component-pass-fill)'
      if (props.status === 'fail') return 'var(--color-component-error-fill)'
      return fillColor.value
    })
    const statusStroke = computed(() => {
      if (props.status === 'pass') return 'var(--color-component-pass-stroke)'
      if (props.status === 'fail') return 'var(--color-component-error-stroke)'
      return strokeColor.value
    })

    const badgeFill = computed(() => {
      if (props.status === 'pass') return '#22c55e' // green
      if (props.status === 'fail') return '#ef4444' // red
      return '#9ca3af' // neutral (pending)
    })

    const badgeGlyph = computed(() => {
      if (props.status === 'pass') return '✓'
      if (props.status === 'fail') return '✗'
      return '?'
    })

    return {
      handleMouseDown,
      strokeWidth,
      componentClasses,
      boxWidth,
      boxHeight,
      statusFill,
      statusStroke,
      badgeFill,
      badgeGlyph,
      GRID_SIZE
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';
</style>
