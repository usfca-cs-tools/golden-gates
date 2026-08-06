<template>
  <g
    :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`"
    :class="['base-circuit-component', componentClass]"
    @dblclick="handleDoubleClick"
  >
    <!-- Component body - can be overridden by child components -->
    <slot name="body">
      <rect
        :x="bodyBounds.x"
        :y="bodyBounds.y"
        :width="bodyBounds.width"
        :height="bodyBounds.height"
        :fill="fillColor"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        :rx="borderRadius"
        :ry="borderRadius"
        class="component-body"
        @mousedown="handleMouseDown"
      />
    </slot>

    <!-- Component label (omitted entirely when the label is empty — e.g. schematic components
         show their filename as a caption instead of a center label) -->
    <slot name="label">
      <text
        v-if="label"
        :x="labelPosition.x"
        :y="labelPosition.y"
        text-anchor="middle"
        :font-size="labelFontSize"
        font-family="Arial, sans-serif"
        :fill="labelColor"
        class="component-label"
      >
        {{ displayLabel }}
      </text>
    </slot>

    <!-- Connection points -->
    <slot name="connections">
      <!-- Input connections -->
      <circle
        v-for="(input, index) in inputConnections"
        :key="`input-${index}`"
        :cx="input.x"
        :cy="input.y"
        :r="connectionRadius"
        :fill="connectionFillColor"
        :stroke="connectionStrokeColor"
        :stroke-width="connectionStrokeWidth"
        class="connection-point input-connection"
        data-type="input"
        :data-port="index"
        :data-component-id="id"
      />

      <!-- Output connections -->
      <circle
        v-for="(output, index) in outputConnections"
        :key="`output-${index}`"
        :cx="output.x"
        :cy="output.y"
        :r="connectionRadius"
        :fill="connectionFillColor"
        :stroke="connectionStrokeColor"
        :stroke-width="connectionStrokeWidth"
        class="connection-point output-connection"
        data-type="output"
        :data-port="index"
        :data-component-id="id"
      />
    </slot>

    <!-- Custom content slot for child components -->
    <slot name="content"></slot>
  </g>
</template>

<script>
import { computed } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { GRID_SIZE } from '../utils/constants'

export default {
  name: 'BaseCircuitComponent',
  props: {
    ...draggableProps,

    // Component appearance
    componentClass: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },

    // Body styling
    bodyBounds: {
      type: Object,
      default: () => ({ x: 0, y: 0, width: 60, height: 40 })
    },
    borderRadius: {
      type: Number,
      default: 4
    },

    // Label styling
    labelPosition: {
      type: Object,
      default: () => ({ x: 30, y: 25 })
    },
    labelFontSize: {
      type: Number,
      default: 10
    },
    labelColor: {
      type: String,
      default: '#333'
    },

    // Connection points
    inputConnections: {
      type: Array,
      default: () => []
    },
    outputConnections: {
      type: Array,
      default: () => []
    },
    connectionRadius: {
      type: Number,
      default: 3
    },
    connectionFillColor: {
      type: String,
      default: '#ffffff'
    },
    connectionStrokeColor: {
      type: String,
      default: '#333'
    },
    connectionStrokeWidth: {
      type: Number,
      default: 1
    },

    // Behavior
    enableDoubleClick: {
      type: Boolean,
      default: false
    }
  },
  emits: ['startDrag', 'doubleClick'],
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth } = useComponentView(props, emit)

    const displayLabel = computed(() => {
      return props.label || 'Component'
    })

    const handleDoubleClick = event => {
      if (props.enableDoubleClick) {
        event.stopPropagation()
        emit('doubleClick', event)
      }
    }

    return {
      handleMouseDown,
      handleDoubleClick,
      fillColor,
      strokeColor,
      strokeWidth,
      displayLabel,
      GRID_SIZE
    }
  }
}
</script>

<style scoped>
@import '../styles/components.css';

/* Component-specific styles only - NO cursor rules */
.component-body {
  transition: fill 0.2s ease;
}

.component-body:hover {
  fill: var(--color-component-hover-fill, #f0f0f0);
}

.component-label {
  pointer-events: none;
  user-select: none;
}

.connection-point {
  transition: fill 0.2s ease;
}

.connection-point:hover {
  fill: #3b82f6;
}
</style>
