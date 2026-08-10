<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Rotation group centered on output point -->
    <g :transform="`rotate(${rotation}, ${GRID_SIZE}, 0)`">
      <!-- Frequency display (above the component, centered) -->
      <text :x="(GRID_SIZE - 5) / 2" y="-15" text-anchor="middle" class="component-value">
        {{ formattedFrequency }}
      </text>

      <!-- Label -->
      <text x="-10" y="5" text-anchor="end" font-size="14" class="component-label">
        {{ label }}
      </text>

      <!-- Clock square wave background (bounding box like Input/Constant) -->
      <rect
        x="-5"
        :y="-(GRID_SIZE + 5) / 2"
        :width="GRID_SIZE + 5"
        :height="GRID_SIZE + 5"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :class="[componentClasses, { 'clock-manual': mode === 'manual' }]"
        @mousedown="handleMouseDown"
      />

      <!-- Square wave pattern inside the bounding box -->
      <g class="clock-waveform" style="pointer-events: none">
        <path
          :d="squareWavePath"
          fill="none"
          :stroke="strokeColor"
          :stroke-width="1.5"
          class="clock-signal"
        />
      </g>

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
  name: 'ClockNode',
  props: {
    ...draggableProps,
    // Clock props
    label: { type: String, default: 'CLK' },
    frequency: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    mode: { type: String as () => 'auto' | 'manual', default: 'auto' }
  },
  emits: ['startDrag'],
  computed: {
    formattedFrequency() {
      return `${this.frequency}Hz`
    },
    squareWavePath() {
      // Create a square wave pattern inside the bounding box
      // Box dimensions: width = GRID_SIZE + 5, height = GRID_SIZE + 5
      // Centered at (0, 0), so box goes from x=-5 to x=GRID_SIZE, y=-(GRID_SIZE+5)/2 to y=(GRID_SIZE+5)/2

      const boxWidth = GRID_SIZE + 5
      const boxHeight = GRID_SIZE + 5
      const startX = -3 // Start 2px inside left edge
      const endX = GRID_SIZE - 2 // End 2px before right edge
      const width = endX - startX

      const topY = -5 // High voltage (5px from center, inside box)
      const bottomY = 5 // Low voltage (5px from center, inside box)

      // Create square wave with 2 full cycles
      const quarterWave = width / 8 // 2 cycles = 8 quarter waves

      const path = [
        `M ${startX} ${bottomY}`, // Start low
        `L ${startX + quarterWave} ${bottomY}`, // Stay low
        `L ${startX + quarterWave} ${topY}`, // Rising edge
        `L ${startX + 3 * quarterWave} ${topY}`, // Stay high
        `L ${startX + 3 * quarterWave} ${bottomY}`, // Falling edge
        `L ${startX + 5 * quarterWave} ${bottomY}`, // Stay low
        `L ${startX + 5 * quarterWave} ${topY}`, // Rising edge
        `L ${startX + 7 * quarterWave} ${topY}`, // Stay high
        `L ${startX + 7 * quarterWave} ${bottomY}`, // Falling edge
        `L ${endX} ${bottomY}` // End low
      ]

      return path.join(' ')
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
      GRID_SIZE,
      mode: props.mode
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';

.clock-signal {
  /* Clock signal should use same color as component stroke */
}

/* Manual clocks are hand-steppable: a click advances one edge while the sim runs.
   The pointer cursor cues that the icon is interactive (a no-move click ticks it). */
.clock-manual {
  cursor: pointer;
}
</style>
