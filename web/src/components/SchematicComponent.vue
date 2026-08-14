<template>
  <BaseCircuitComponent
    :x="x"
    :y="y"
    :id="id"
    :selected="selected"
    :label="''"
    :body-bounds="componentBounds"
    :base-fill="bodyColor"
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
      <!-- Input labels ("_" renders the tail as a subscript, e.g. IW_0) -->
      <text
        v-for="(input, index) in circuitInterface?.inputs || []"
        :key="`input-${index}`"
        :x="inputLabelPositions[index]?.x"
        :y="inputLabelPositions[index]?.y"
        :transform="inputLabelPositions[index]?.transform"
        :dominant-baseline="inputLabelPositions[index]?.baseline"
        font-size="10"
        font-family="Arial, sans-serif"
        :fill="COLORS.componentText"
        :text-anchor="inputLabelPositions[index]?.anchor"
        class="component-label"
        ><tspan
          v-for="(part, i) in subscriptParts(input.label)"
          :key="i"
          :font-size="part.subscript ? '0.72em' : null"
          :dy="part.drop ? '0.22em' : null"
          >{{ part.text }}</tspan
        ></text
      >

      <!-- Output labels ("_" renders the tail as a subscript, e.g. IW_0) -->
      <text
        v-for="(output, index) in circuitInterface?.outputs || []"
        :key="`output-${index}`"
        :x="outputLabelPositions[index]?.x"
        :y="outputLabelPositions[index]?.y"
        :transform="outputLabelPositions[index]?.transform"
        :dominant-baseline="outputLabelPositions[index]?.baseline"
        font-size="10"
        font-family="Arial, sans-serif"
        :fill="COLORS.componentText"
        :text-anchor="outputLabelPositions[index]?.anchor"
        class="component-label"
        ><tspan
          v-for="(part, i) in subscriptParts(output.label)"
          :key="i"
          :font-size="part.subscript ? '0.72em' : null"
          :dy="part.drop ? '0.22em' : null"
          >{{ part.text }}</tspan
        ></text
      >

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
import { GRID_SIZE, COLORS } from '../utils/constants'
import { atLeast } from '../utils/version'
import { subscriptParts } from '../utils/labelFormat'
import { computeSubcircuitLayout, portEdge } from '../utils/subcircuitPorts'

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
    const LABEL_VERTICAL_MARGIN = Math.round(GRID_SIZE / 3) // ~5px when GRID_SIZE=15

    const handleDoubleClick = event => {
      emit('editSubcircuit', props.circuitId)
    }

    // Where each port's name is drawn inside the box, keyed on the edge the port sits on (which
    // depends on its role AND rotation). Left/right labels are horizontal, reading inward. Top and
    // bottom ports pack tightly side-by-side, so a horizontal label would overprint its neighbor —
    // rotate those to read vertically INTO the box (down from the top, up from the bottom), matching
    // the orientation of the rotated child input/output.
    const getLabelPosition = (connection, rotation, isInput = true) => {
      const { x, y } = connection
      const edge = portEdge(isInput, rotation)
      if (edge === 'top') {
        return {
          x: x + LABEL_VERTICAL_MARGIN,
          y,
          anchor: 'start',
          baseline: 'central',
          transform: `rotate(90, ${x}, ${y})`
        }
      }
      if (edge === 'bottom') {
        return {
          x: x + LABEL_VERTICAL_MARGIN,
          y,
          anchor: 'start',
          baseline: 'central',
          transform: `rotate(-90, ${x}, ${y})`
        }
      }
      if (edge === 'right') {
        return { x: x - LABEL_HORIZONTAL_MARGIN, y: y + 4, anchor: 'end' }
      }
      // left edge
      return { x: x + LABEL_HORIZONTAL_MARGIN, y: y + 4, anchor: 'start' }
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
            rotation: component.props?.rotation || 0,
            x: component.x,
            y: component.y
          })
        } else if (component.type === 'output') {
          outputs.push({
            id: component.id,
            label: component.props?.label || 'OUT',
            bits: component.props?.bits || 1,
            rotation: component.props?.rotation || 0,
            x: component.x,
            y: component.y
          })
        }
      })

      // Match the port numbering in componentRegistry.getConnections: geometric (top-to-bottom)
      // order for 1.6+ definitions, insertion order before that.
      if (atLeast(circuit.formatVersion, [1, 6])) {
        const byPosition = (a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0)
        inputs.sort(byPosition)
        outputs.sort(byPosition)
      }

      return { inputs, outputs }
    })

    // The referenced subcircuit's per-definition appearance (color + manual size).
    const appearance = computed(() => {
      const circuit = props.circuitManager.getCircuit(props.circuitId)
      return circuit?.properties || {}
    })

    // Optional per-definition body color; null falls back to the theme default in useComponentView.
    // PrimeVue's ColorPicker stores a bare hex ("6466f1"); normalize to a CSS "#6466f1" for fill.
    const bodyColor = computed(() => {
      const c = appearance.value.color
      return c ? '#' + String(c).replace(/^#/, '') : null
    })

    // Shared geometry: box size + every port's connection point in grid units, IDENTICAL to what
    // componentRegistry.getConnections serializes — so the rendered dots sit exactly on the
    // coordinates wires are matched against. Manual width feeds the layout (it carries the output
    // ports on the right edge); manual height only stretches the frame below (see componentBounds).
    const portLayout = computed(() => {
      const a = appearance.value
      const forcedWidth = a.sizeMode === 'manual' && a.width > 0 ? a.width : 0
      return computeSubcircuitLayout(
        circuitInterface.value?.inputs || [],
        circuitInterface.value?.outputs || [],
        { forcedWidth }
      )
    })

    // The visible frame. Width comes from the layout (default 6, manual width, or wide enough for
    // top/bottom ports); manual height only grows the frame downward, clamped to the port span so
    // ports never spill.
    const componentBounds = computed(() => {
      const a = appearance.value
      const { width, height } = portLayout.value
      const portSpan = height * GRID_SIZE
      const frameHeight =
        a.sizeMode === 'manual' && a.height > 0
          ? Math.max(a.height * GRID_SIZE, portSpan)
          : portSpan
      return { x: 0, y: 0, width: width * GRID_SIZE, height: frameHeight }
    })

    const labelPosition = computed(() => {
      const bounds = componentBounds.value
      return { x: bounds.width / 2, y: bounds.height / 2 + 4 }
    })

    const inputConnections = computed(() => {
      const inputs = circuitInterface.value?.inputs || []
      const { inputPoints, height } = portLayout.value
      if (inputs.length === 0) {
        // Historical default single input, centered on the port span.
        return [{ x: 0, y: Math.round(height / 2) * GRID_SIZE }]
      }
      return inputPoints.map(p => ({ x: p.x * GRID_SIZE, y: p.y * GRID_SIZE }))
    })

    const outputConnections = computed(() => {
      const outputs = circuitInterface.value?.outputs || []
      const { outputPoints, width, height } = portLayout.value
      if (outputs.length === 0) {
        // Historical default single output, centered on the right edge.
        return [{ x: width * GRID_SIZE, y: Math.round(height / 2) * GRID_SIZE }]
      }
      return outputPoints.map(p => ({ x: p.x * GRID_SIZE, y: p.y * GRID_SIZE }))
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
      bodyColor,
      labelPosition,
      inputConnections,
      outputConnections,
      inputLabelPositions,
      outputLabelPositions,
      subscriptParts,
      COLORS
    }
  }
}
</script>

<style scoped>
/* Additional styles specific to schematic components */
/* Base styles are inherited from BaseCircuitComponent */
</style>
