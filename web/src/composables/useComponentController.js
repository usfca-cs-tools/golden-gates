import { ref } from 'vue'
import { componentRegistry } from '../utils/componentRegistry'

/**
 * Component Controller - Business logic for component operations
 * Handles component creation, smart positioning, and component-related utilities
 */
export function useComponentController(circuitManager, canvasOperations) {
  const { snapToGrid, gridSize } = canvasOperations
  const { activeCircuit, addComponent } = circuitManager

  // Track last component position for intelligent placement (in grid units)
  const lastComponentPosition = ref({ x: 7, y: 7 })

  /**
   * Add component at smart position with auto-naming and unique ID generation
   */
  function addComponentAtSmartPosition(type, customProps = {}) {
    // Ensure we have a current circuit to add components to
    if (!activeCircuit.value) {
      console.warn('No current circuit available for component insertion')
      return null
    }

    // Use last component position with offset (5 grid units down)
    const x = lastComponentPosition.value.x
    const y = lastComponentPosition.value.y + 5
    const snapped = { x, y } // Already in grid units

    // Get component configuration
    const config = componentRegistry[type]
    if (!config) return null

    // Count existing components of this type to generate unique ID
    const existingOfType = activeCircuit.value.components.filter(c => c.type === type).length
    const componentId = `${type}_${existingOfType + 1}_${Date.now()}`

    // Create new component
    const newComponent = {
      id: componentId,
      type,
      x: snapped.x,
      y: snapped.y,
      props: { ...config.defaultProps, ...customProps }
    }

    // Handle special component types with onCreate
    if (config.onCreate) {
      if (type === 'input') {
        const inputCount = activeCircuit.value.components.filter(c => c.type === 'input').length
        config.onCreate(newComponent, inputCount)
      } else if (type === 'output') {
        const outputCount = activeCircuit.value.components.filter(c => c.type === 'output').length
        config.onCreate(newComponent, outputCount)
      }
    }

    // Add to circuit
    addComponent(newComponent)

    // Update last component position
    lastComponentPosition.value = { x: snapped.x, y: snapped.y }

    return newComponent
  }

  /**
   * Add a component at an explicit grid position (used by drag-to-place from the sidebar, where
   * the user drops it exactly where they want). Shares createComponent's id/onCreate logic with
   * addComponentAtSmartPosition; only the position source differs. `position` is in grid units.
   */
  function addComponentAtPosition(type, position, customProps = {}) {
    if (!activeCircuit.value) {
      console.warn('No current circuit available for component insertion')
      return null
    }

    const component = createComponent(type, position.x, position.y, customProps)
    if (!component) return null

    addComponent(component)
    lastComponentPosition.value = { x: position.x, y: position.y }
    return component
  }

  /**
   * Get component configuration from registry
   */
  function getComponentConfig(type) {
    return componentRegistry[type]
  }

  /**
   * Get component connections (handles dynamic connections)
   */
  function getComponentConnections(component) {
    const config = componentRegistry[component.type]
    if (!config) return { inputs: [], outputs: [] }

    if (config.getConnections) {
      return config.getConnections(component.props, circuitManager)
    } else {
      return config.connections || { inputs: [], outputs: [] }
    }
  }

  /**
   * Get component dimensions (handles dynamic dimensions)
   */
  function getComponentDimensions(component) {
    const config = componentRegistry[component.type]
    if (!config) return { width: 0, height: 0 }

    if (config.getDimensions) {
      return config.getDimensions(component.props)
    } else {
      return config.dimensions || { width: 0, height: 0 }
    }
  }

  /**
   * Find component at a specific connection point
   */
  function findComponentAtConnection(components, connection) {
    for (const component of components) {
      const connections = getComponentConnections(component)

      // Check if this connection matches an output
      if (connection.portType === 'output' && connections.outputs) {
        const output = connections.outputs[connection.portIndex]
        if (output) {
          const outputPos = { x: component.x + output.x, y: component.y + output.y }
          if (outputPos.x === connection.pos.x && outputPos.y === connection.pos.y) {
            return component
          }
        }
      }

      // Check if this connection matches an input
      if (connection.portType === 'input' && connections.inputs) {
        const input = connections.inputs[connection.portIndex]
        if (input) {
          const inputPos = { x: component.x + input.x, y: component.y + input.y }
          if (inputPos.x === connection.pos.x && inputPos.y === connection.pos.y) {
            return component
          }
        }
      }
    }
    return null
  }

  /**
   * Update last component position (for smart positioning)
   */
  function updateLastComponentPosition(x, y) {
    lastComponentPosition.value = { x, y }
  }

  /**
   * Generate unique component ID
   */
  function generateComponentId(type, existingComponents = []) {
    const existingOfType = existingComponents.filter(c => c.type === type).length
    return `${type}_${existingOfType + 1}_${Date.now()}`
  }

  /**
   * Create component instance with default properties
   */
  function createComponent(type, x, y, customProps = {}) {
    const config = componentRegistry[type]
    if (!config) return null

    const componentId = generateComponentId(type, activeCircuit.value?.components || [])

    const component = {
      id: componentId,
      type,
      x,
      y,
      props: { ...config.defaultProps, ...customProps }
    }

    // Handle special component types with onCreate
    if (config.onCreate) {
      if (type === 'input') {
        const inputCount =
          activeCircuit.value?.components.filter(c => c.type === 'input').length || 0
        config.onCreate(component, inputCount)
      } else if (type === 'output') {
        const outputCount =
          activeCircuit.value?.components.filter(c => c.type === 'output').length || 0
        config.onCreate(component, outputCount)
      }
    }

    return component
  }

  return {
    // State
    lastComponentPosition,

    // Component creation and management
    addComponentAtSmartPosition,
    addComponentAtPosition,
    createComponent,
    generateComponentId,
    updateLastComponentPosition,

    // Component utilities
    getComponentConfig,
    getComponentConnections,
    getComponentDimensions,
    findComponentAtConnection
  }
}
