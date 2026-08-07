<template>
  <g
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mouseenter="handleValueHover"
    @mousemove="handleValueHover"
    @mouseleave="handleValueHoverEnd"
    :data-wire-index="$attrs['data-wire-index']"
  >
    <!-- Invisible wider line for easier clicking -->
    <polyline
      v-if="!preview"
      :points="pointsString"
      fill="none"
      stroke="transparent"
      :stroke-width="strokeWidth + 8"
      stroke-linejoin="round"
      stroke-linecap="round"
      class="wire-hitbox"
    />
    <!-- Visible wire -->
    <polyline
      :points="pointsString"
      fill="none"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      stroke-linejoin="round"
      stroke-linecap="round"
      class="wire wire-segment"
      :class="{
        preview: preview,
        selected: selected,
        'wire-high': stepActive && stepStyle === 'processing',
        'wire-low': !stepActive && stepStyle === 'processing'
      }"
    />
  </g>
</template>

<script>
import { computed } from 'vue'
import { COLORS, STROKE_WIDTHS, gridToPixel } from '../utils/constants'
import { formatBusValue } from '../utils/formatBusValue'

export default {
  name: 'Wire',
  props: {
    points: {
      type: Array,
      required: true
    },
    preview: {
      type: Boolean,
      default: false
    },
    selected: {
      type: Boolean,
      default: false
    },
    stepActive: {
      type: Boolean,
      default: false
    },
    stepStyle: {
      type: String,
      default: 'processing'
    },
    // The value/width propagating on this wire, when known (issue #133). Only multi-bit
    // buses show a hover tooltip; single-bit wires keep just the high/low coloring.
    // A string when it comes from the engine (exact 64-bit; formatBusValue parses with BigInt).
    value: {
      type: [Number, String],
      default: null
    },
    bits: {
      type: Number,
      default: 1
    }
  },
  emits: ['click', 'mousedown', 'valueHover', 'valueHoverEnd'],
  setup(props, { emit }) {
    const pointsString = computed(() => {
      return props.points
        .map(p => {
          const pixelPoint = gridToPixel(p)
          return `${pixelPoint.x},${pixelPoint.y}`
        })
        .join(' ')
    })

    const strokeColor = computed(() => {
      if (props.preview) return COLORS.wirePreview
      if (props.selected) return COLORS.wireSelected
      // Wire state colors are now handled by CSS classes
      return COLORS.wire
    })

    const strokeWidth = computed(() => {
      return props.selected ? STROKE_WIDTHS.wireSelected : STROKE_WIDTHS.wire
    })

    const handleClick = event => {
      if (!props.preview) {
        emit('click', event)
      }
    }

    const handleMouseDown = event => {
      if (!props.preview) {
        emit('mousedown', event)
      }
    }

    // Only multi-bit buses with a known value show a value tooltip. The parent renders it
    // at the cursor (SVG can't host a reliable PrimeVue tooltip), so pass the text + point.
    const busText = computed(() =>
      !props.preview && props.bits > 1 && props.value != null
        ? formatBusValue(props.value, props.bits)
        : null
    )

    const handleValueHover = event => {
      if (busText.value) {
        emit('valueHover', { text: busText.value, x: event.clientX, y: event.clientY })
      }
    }

    const handleValueHoverEnd = () => {
      emit('valueHoverEnd')
    }

    return {
      pointsString,
      strokeColor,
      strokeWidth,
      handleClick,
      handleMouseDown,
      handleValueHover,
      handleValueHoverEnd
    }
  }
}
</script>

<style scoped>
.wire {
  pointer-events: stroke;
  cursor: move;
}

.wire.preview {
  opacity: 0.6;
  stroke-dasharray: 5, 5;
  cursor: crosshair;
}

.wire.selected {
  filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.5));
}

.wire-hitbox {
  pointer-events: stroke;
  cursor: move;
}
</style>
