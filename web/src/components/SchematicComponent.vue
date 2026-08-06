<template>
  <BaseCircuitComponent
    :x="x"
    :y="y"
    :id="id"
    :selected="selected"
    :label="''"
    :body-bounds="componentBounds"
    :label-position="labelPosition"
    :input-connections="inputConnections"
    :output-connections="outputConnections"
    :enable-double-click="true"
    :connection-fill-color="COLORS.connectionFill"
    :connection-stroke-color="COLORS.connectionFill"
    :connection-stroke-width="0"
    component-class="schematic-component"
    @startDrag="$emit('startDrag', $event)"
    @doubleClick="handleDoubleClick"
  >
    <!-- No center label (label="" above): the frame carries only the input/output names; the
         filename is a caption below the component (see #content). -->

    <!-- Custom labels for inputs and outputs, plus the filename caption -->
    <template #content>
      <!-- Input labels -->
      <text
        v-for="(input, index) in circuitInterface?.inputs || []"
        :key="`input-${index}`"
        :x="inputLabelPositions[index]?.x"
        :y="inputLabelPositions[index]?.y"
        font-size="10"
        font-family="Arial, sans-serif"
        :fill="COLORS.componentText"
        :text-anchor="inputLabelPositions[index]?.anchor"
        class="component-label"
      >
        {{ input.label }}
      </text>

      <!-- Output labels -->
      <text
        v-for="(output, index) in circuitInterface?.outputs || []"
        :key="`output-${index}`"
        :x="outputLabelPositions[index]?.x"
        :y="outputLabelPositions[index]?.y"
        font-size="10"
        font-family="Arial, sans-serif"
        :fill="COLORS.componentText"
        :text-anchor="outputLabelPositions[index]?.anchor"
        class="component-label"
      >
        {{ output.label }}
      </text>

      <!-- Filename caption, centered below the frame -->
      <text
        :x="componentBounds.width / 2"
        :y="componentBounds.height + 12"
        font-size="10"
        font-family="Arial, sans-serif"
        :fill="COLORS.componentText"
        text-anchor="middle"
        class="component-caption"
      >
        {{ componentLabel }}
      </text>
    </template>
  </BaseCircuitComponent>
</template>

<script>
import { computed } from 'vue'
import BaseCircuitComponent from './BaseCircuitComponent.vue'
import { draggableProps } from '../composables/useComponentView'
import { GRID_SIZE, COLORS, PORT_PITCH } from '../utils/constants'

export default {
  name: 'SchematicComponent',
  components: {
    BaseCircuitComponent
  },
  props: {
    ...draggableProps,
    circuitId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: 'Component'
    },
    circuitManager: {
      type: Object,
      required: true
    }
  },
  emits: ['startDrag', 'editSubcircuit'],
  setup(props, { emit }) {
    // Constants for label positioning based on GRID_SIZE
    const LABEL_HORIZONTAL_MARGIN = Math.round(GRID_SIZE / 2) // ~8px when GRID_SIZE=15
    const LABEL_VERTICAL_SPACING = GRID_SIZE // 15px when GRID_SIZE=15
    const LABEL_VERTICAL_MARGIN = Math.round(GRID_SIZE / 3) // ~5px when GRID_SIZE=15

    const handleDoubleClick = event => {
      emit('editSubcircuit', props.circuitId)
    }

    // Helper function to get connection point position based on rotation
    const getRotatedConnectionPoint = (rotation, bounds, defaultY) => {
      const rotationMap = {
        90: { x: bounds.width / 2, y: 0 },
        180: { x: bounds.width, y: defaultY },
        270: { x: bounds.width / 2, y: bounds.height },
        0: { x: 0, y: defaultY }
      }
      return rotationMap[rotation] || rotationMap[0]
    }

    // Helper function to get rotated connection point for outputs
    const getRotatedOutputConnectionPoint = (rotation, bounds, defaultY) => {
      const rotationMap = {
        90: { x: bounds.width / 2, y: bounds.height },
        180: { x: 0, y: defaultY },
        270: { x: bounds.width / 2, y: 0 },
        0: { x: bounds.width, y: defaultY }
      }
      return rotationMap[rotation] || rotationMap[0]
    }

    // Helper function to get label position based on rotation
    const getLabelPosition = (connection, rotation, isInput = true) => {
      const positionMap = {
        90: {
          x: connection.x,
          y: connection.y + (isInput ? LABEL_VERTICAL_SPACING : -LABEL_VERTICAL_MARGIN),
          anchor: 'middle'
        },
        180: {
          x: connection.x + (isInput ? -LABEL_HORIZONTAL_MARGIN : LABEL_HORIZONTAL_MARGIN),
          y: connection.y + 4,
          anchor: isInput ? 'end' : 'start'
        },
        270: {
          x: connection.x,
          y: connection.y + (isInput ? -LABEL_VERTICAL_MARGIN : LABEL_VERTICAL_SPACING),
          anchor: 'middle'
        },
        0: {
          x: connection.x + (isInput ? LABEL_HORIZONTAL_MARGIN : -LABEL_HORIZONTAL_MARGIN),
          y: connection.y + 4,
          anchor: isInput ? 'start' : 'end'
        }
      }
      return positionMap[rotation] || positionMap[0]
    }

    // The caption shown below the component: the subcircuit's filename (its name). The old
    // display "label" is retired — only input/output names live inside the frame now.
    const componentLabel = computed(() => {
      const circuit = props.circuitManager.getCircuit(props.circuitId)
      return circuit?.name || props.label || 'Component'
    })

    // Computed interface that updates when the source circuit changes
    const circuitInterface = computed(() => {
      const circuit = props.circuitManager.getCircuit(props.circuitId)
      if (!circuit) {
        return { inputs: [], outputs: [] }
      }

      const inputs = []
      const outputs = []

      // Find all input and output components in the circuit
      circuit.components.forEach(component => {
        if (component.type === 'input') {
          inputs.push({
            id: component.id,
            label: component.props?.label || 'IN',
            bits: component.props?.bits || 1,
            rotation: component.props?.rotation || 0
          })
        } else if (component.type === 'output') {
          outputs.push({
            id: component.id,
            label: component.props?.label || 'OUT',
            bits: component.props?.bits || 1,
            rotation: component.props?.rotation || 0
          })
        }
      })

      return { inputs, outputs }
    })

    // Computed properties for dynamic sizing based on interface
    const componentBounds = computed(() => {
      const inputs = circuitInterface.value?.inputs || []
      const outputs = circuitInterface.value?.outputs || []
      const maxPorts = Math.max(inputs.length, outputs.length, 1)

      // Calculate grid-aligned dimensions
      // Width: 6 grid units (90px) - should be divisible by GRID_SIZE
      const width = 6 * GRID_SIZE

      // Height: Ensure connection points align with grid.
      // 1 grid unit margin above the first port + PORT_PITCH per gap + 1 below the last.
      const minHeight = 4 * GRID_SIZE // 2 above + 2 below
      const heightForPorts = ((maxPorts - 1) * PORT_PITCH + 2) * GRID_SIZE
      const height = Math.max(minHeight, heightForPorts)

      return { x: 0, y: 0, width, height }
    })

    const labelPosition = computed(() => {
      const bounds = componentBounds.value
      return { x: bounds.width / 2, y: bounds.height / 2 + 4 }
    })

    const inputConnections = computed(() => {
      const inputs = circuitInterface.value?.inputs || []
      const bounds = componentBounds.value

      if (inputs.length === 0) {
        // Default single input at center, snapped to grid
        const centerY = Math.round(bounds.height / 2 / GRID_SIZE) * GRID_SIZE
        return [{ x: 0, y: centerY }]
      }

      return inputs.map((input, index) => {
        let y
        if (inputs.length === 1) {
          // Single input at center
          y = bounds.height / 2
        } else {
          // Multiple inputs: PORT_PITCH grid units apart
          const topMargin = GRID_SIZE // 1 grid unit from top
          const inputSpacing = PORT_PITCH * GRID_SIZE
          y = topMargin + index * inputSpacing
        }

        // Snap to nearest grid vertex
        y = Math.round(y / GRID_SIZE) * GRID_SIZE

        // Apply rotation based on the original component's rotation
        const rotation = input.rotation || 0
        return getRotatedConnectionPoint(rotation, bounds, y)
      })
    })

    const outputConnections = computed(() => {
      const outputs = circuitInterface.value?.outputs || []
      const bounds = componentBounds.value

      if (outputs.length === 0) {
        // Default single output at center, snapped to grid
        const centerY = Math.round(bounds.height / 2 / GRID_SIZE) * GRID_SIZE
        return [{ x: bounds.width, y: centerY }]
      }

      return outputs.map((output, index) => {
        let y
        if (outputs.length === 1) {
          // Single output at center
          y = bounds.height / 2
        } else {
          // Multiple outputs: same pitch as inputs
          const topMargin = GRID_SIZE // 1 grid unit from top
          const outputSpacing = PORT_PITCH * GRID_SIZE
          y = topMargin + index * outputSpacing
        }

        // Snap to nearest grid vertex
        y = Math.round(y / GRID_SIZE) * GRID_SIZE

        // Apply rotation based on the original component's rotation
        const rotation = output.rotation || 0
        return getRotatedOutputConnectionPoint(rotation, bounds, y)
      })
    })

    // Computed input label positions
    const inputLabelPositions = computed(() => {
      const inputs = circuitInterface.value?.inputs || []
      const connections = inputConnections.value

      return inputs.map((input, index) => {
        const connection = connections[index]
        const rotation = input.rotation || 0
        return getLabelPosition(connection, rotation, true)
      })
    })

    // Computed output label positions
    const outputLabelPositions = computed(() => {
      const outputs = circuitInterface.value?.outputs || []
      const connections = outputConnections.value

      return outputs.map((output, index) => {
        const connection = connections[index]
        const rotation = output.rotation || 0
        return getLabelPosition(connection, rotation, false)
      })
    })

    return {
      handleDoubleClick,
      componentLabel,
      circuitInterface,
      componentBounds,
      labelPosition,
      inputConnections,
      outputConnections,
      inputLabelPositions,
      outputLabelPositions,
      COLORS
    }
  }
}
</script>

<style scoped>
/* Additional styles specific to schematic components */
/* Base styles are inherited from BaseCircuitComponent */
</style>
