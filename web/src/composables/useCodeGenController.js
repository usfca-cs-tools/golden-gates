import { ref } from 'vue'
import { componentRegistry } from '../utils/componentRegistry'
import { resetNameRegistry } from '../generators/BaseComponentGenerator'
import { createComponentGenerator } from '../generators/ComponentGeneratorFactory'
import { useCircuitValidator } from './useCircuitValidator'

export function useCodeGenController() {
  // All components now use TypeScript mixins for code generation
  // No fallback logic needed - every component implements generate() via mixins

  // Convert a circuit display name (which may contain hyphens or start with a digit)
  // into a valid Python identifier for use in generated code
  function toPythonIdentifier(name) {
    let identifier = name.replace(/-/g, '_')
    if (/^[0-9]/.test(identifier)) {
      identifier = '_' + identifier
    }
    return identifier
  }

  // Helper function to get component connections (unified with validator logic)
  function getComponentConnections(component, circuitManager) {
    const config = componentRegistry[component.type]
    if (!config) return null

    return config.getConnections
      ? config.getConnections(component.props, circuitManager)
      : config.connections
  }

  // Helper function to get component outputs
  function getComponentOutputs(component, circuitManager) {
    const connections = getComponentConnections(component, circuitManager)
    return connections?.outputs || []
  }

  // Helper function to get component inputs
  function getComponentInputs(component, circuitManager) {
    const connections = getComponentConnections(component, circuitManager)
    return connections?.inputs || []
  }

  // Helper function to get port name from port index
  function getPortName(ports, portIndex, portType) {
    if (ports && Array.isArray(ports) && portIndex >= 0 && portIndex < ports.length) {
      const port = ports[portIndex]

      if (port && typeof port === 'object') {
        // For schematic components, use the label from the interface
        if (port.label) {
          return port.label
        }

        // For components with named ports (like splitter/merger), use the name
        if (port.name) {
          return port.name
        }

        // Fallback to port id if no label
        if (port.id) {
          return port.id
        }
      }
    }

    // Enhanced error reporting when port name cannot be resolved
    if (ports && Array.isArray(ports)) {
      console.warn(
        `getPortName: Port index ${portIndex} out of bounds for ${portType} ports array of length ${ports.length}. Available ports:`,
        ports.map(p => p?.label || p?.name || p?.id || 'unnamed')
      )
    } else {
      console.warn(`getPortName: Invalid ports array for ${portType}:`, ports)
    }

    // Fallback to port index for regular components or when no name is found
    return portIndex.toString()
  }

  // Legacy component finding function - replaced by circuit validator
  // Kept only for backward compatibility, but no longer used in main code paths

  function generateGglProgram(
    components,
    wires,
    wireJunctions,
    componentRefs,
    componentInstances,
    circuitManager = null,
    includeRun = true,
    circuitName = null
  ) {
    // Reset the global name registry for fresh sequential naming
    resetNameRegistry()

    // Create circuit validator to resolve connections from geometry
    const componentRefsForValidator = ref(components)
    const wireRefsForValidator = ref(wires)
    const validator = useCircuitValidator(
      componentRefsForValidator,
      wireRefsForValidator,
      circuitManager
    )

    const sections = []
    const circuitVarName = 'circuit0' // Dynamic circuit name to avoid conflicts

    // Header - import all GGL modules (unused imports are not an error in Python)
    sections.push(
      `from ggl import arithmetic, circuit, component, io, logic, memory, plexers, wires`
    )

    // Import all circuit components used in this circuit
    const componentImports = findRequiredComponentImports(components, circuitManager)
    if (componentImports) {
      sections.push(componentImports)
    }

    sections.push('')
    sections.push(
      `${circuitVarName} = circuit.Circuit(js_logging=True, circuit_name=${JSON.stringify(circuitName)})`
    )
    sections.push('')

    // Phase 1: Generate all components first
    const componentVarNames = {} // Map component IDs to their variable names
    const componentErrors = [] // Collect errors for components

    // Simple component ordering: inputs first, then others
    // Component declaration order doesn't affect correctness since we handle connections separately
    const componentOrder = [
      ...components.filter(c => c.type === 'input'),
      ...components.filter(c => c.type !== 'input' && c.type !== 'output'),
      ...components.filter(c => c.type === 'output')
    ]

    // Generate all component declarations first
    for (const component of componentOrder) {
      let varName

      if (component.type === 'schematic-component') {
        // Handle schematic components (saved circuits)
        const circuitId = component.props?.circuitId || component.circuitId
        const componentDef = circuitManager?.getComponentDefinition?.(circuitId)
        if (componentDef) {
          // Create meaningful variable name based on the circuit name
          const pyName = toPythonIdentifier(componentDef.name)
          const baseName = pyName.toLowerCase()
          const instanceCount =
            componentOrder
              .filter(
                c =>
                  c.type === 'schematic-component' &&
                  (c.props?.circuitId || c.circuitId) === circuitId
              )
              .indexOf(component) + 1
          varName = `${baseName}_${instanceCount}`
          componentVarNames[component.id] = varName
          sections.push(`${varName} = ${pyName}()`)
        } else {
          console.error(`Schematic component definition not found for ${circuitId}`)
          varName = `comp_${component.id.replace(/-/g, '_')}`
          componentVarNames[component.id] = varName
        }
      } else {
        // Handle regular components (input, output, logic gates)
        varName = `comp_${component.id.replace(/-/g, '_')}`
        componentVarNames[component.id] = varName

        const instance = componentInstances[component.id]
        if (instance && instance.generate) {
          // Use the component's own generate() method (all components have this via mixins)
          const generated = instance.generate()

          // Update varName to match the component's preferred naming
          componentVarNames[component.id] = generated.varName

          // Create component
          sections.push(generated.code)
        } else {
          // Use TypeScript factory to generate code from component data
          try {
            const generator = createComponentGenerator(component, { isMainCircuit: includeRun })
            const generated = generator.generate()
            componentVarNames[component.id] = generated.varName
            sections.push(generated.code)
          } catch (error) {
            console.error(
              `Failed to generate code for component ${component.id} of type ${component.type}:`,
              error
            )
            continue
          }
        }
      }
    }

    sections.push('')

    // Phase 2: Generate all connections using simplified validator
    const validConnections = validator.getValidConnections()
    const processedConnections = new Set()

    // Process all valid connections
    for (const connection of validConnections) {
      const { wire, sourceComponent, sourcePortIndex, targetComponent, targetPortIndex } =
        connection

      const sourceVarName = componentVarNames[sourceComponent.id]
      const targetVarName = componentVarNames[targetComponent.id]

      if (!sourceVarName || !targetVarName) {
        console.error(
          `Variable names not found for components: ${sourceComponent.id} -> ${targetComponent.id}`
        )
        continue
      }

      // Create a unique key for this connection to avoid duplicates
      const connectionKey = `${sourceComponent.id}:${sourcePortIndex}->${targetComponent.id}:${targetPortIndex}`

      if (!processedConnections.has(connectionKey)) {
        processedConnections.add(connectionKey)
        sections.push(
          generateConnectionWithComponents(
            wire,
            sourceComponent,
            targetComponent,
            sourcePortIndex,
            targetPortIndex,
            componentVarNames,
            sourceVarName,
            targetVarName,
            circuitVarName,
            circuitManager
          )
        )
      }
    }

    // Declare any component wired to nothing so the engine still preflights it.
    // connect() above registered every wired component; a component that appears
    // in zero connections never reached connect() and would otherwise be invisible
    // to the engine (so its open inputs would go unflagged — the dropped-wire bug).
    // We emit add_orphan() only for those, so a correct circuit generates no extra
    // lines and a lone add_orphan() is a visible smell. Tunnels and Tests are not
    // simulation nodes (pure connectivity / verification directives), so skip them.
    const NON_NODE_TYPES = new Set(['tunnel', 'test'])
    const connectedIds = new Set()
    for (const connection of validConnections) {
      connectedIds.add(connection.sourceComponent.id)
      connectedIds.add(connection.targetComponent.id)
    }
    for (const component of componentOrder) {
      const varName = componentVarNames[component.id]
      if (varName && !NON_NODE_TYPES.has(component.type) && !connectedIds.has(component.id)) {
        sections.push(`${circuitVarName}.add_orphan(${varName})`)
      }
    }

    // Report any validation errors
    const validation = validator.validateCircuit()
    if (!validation.valid) {
      validation.errors.forEach(error => {
        componentErrors.push({
          componentId: 'circuit',
          error: {
            severity: 'error',
            messageId: 'CIRCUIT_VALIDATION_ERROR',
            message: error,
            details: {}
          }
        })
      })
    }

    // Note: Junction connections are automatically handled by the geometry-based validator
    // All connections are resolved purely from wire endpoint positions

    // Only include the run call for main circuit execution, not for component definitions.
    // run_async() is the long-running browser entry point (free-running clock + live
    // input updates via update_input(), until stop()); the bare run() is now the
    // synchronous settle used by the headless test suite.
    if (includeRun) {
      // Collect Test components (verification directives) in component order.
      // A Test drives named Inputs, settles the circuit, and checks named Outputs
      // via <testvar>.evaluate(circuit0), which emits a 'test' callback per result.
      const testVarNames = components
        .filter(c => c.type === 'test')
        .map(c => componentVarNames[c.id])
        .filter(Boolean)

      if (testVarNames.length > 0) {
        // When the circuit contains Tests, run each test's evaluate() instead of
        // the free-running run_async(): evaluate() itself settles the circuit.
        for (const testVar of testVarNames) {
          sections.push(`${testVar}.evaluate(${circuitVarName})`)
        }
      } else {
        sections.push(`await ${circuitVarName}.run_async()`)
      }
    }

    // Return both the generated code and any errors
    return {
      code: sections.join('\n'),
      errors: componentErrors
    }
  }

  function generateConnectionWithComponents(
    wire,
    sourceComp,
    destComp,
    sourcePortIndex,
    destPortIndex,
    componentVarNames,
    sourceVarName,
    destVarName,
    circuitVarName,
    circuitManager = null
  ) {
    const sourcePort = sourcePortIndex
    const destPort = destPortIndex

    // Get component configurations (either from registry or schematic definitions)
    const sourceOutputs = getComponentOutputs(sourceComp, circuitManager)
    const destInputs = getComponentInputs(destComp, circuitManager)

    // Generate connection based on number of ports
    let sourceExpr = sourceVarName
    let destExpr = destVarName

    // Get component configurations
    const sourceConfig = componentRegistry[sourceComp.type]
    const destConfig = componentRegistry[destComp.type]

    // Determine if we need to specify port names
    const sourceRequiresNamedPorts =
      sourceComp.type === 'schematic-component' ||
      sourceConfig?.requiresNamedPorts ||
      sourceOutputs.length > 1

    const destRequiresNamedPorts =
      destComp.type === 'schematic-component' ||
      destConfig?.requiresNamedPorts ||
      destInputs.length > 1

    if (sourceRequiresNamedPorts) {
      const outputName = getPortName(sourceOutputs, sourcePort, 'output')
      sourceExpr = `${sourceVarName}.output("${outputName}")`
    }

    if (destRequiresNamedPorts) {
      const inputName = getPortName(destInputs, destPort, 'input')
      destExpr = `${destVarName}.input("${inputName}")`
    }

    // Generate descriptive comment
    let comment = `# ${sourceVarName}`
    if (sourceOutputs.length > 1 && sourcePort > 0) {
      comment += `.out[${sourcePort}]`
    }
    comment += ` -> ${destVarName}`
    if (destInputs.length > 1 || destPort > 0) {
      comment += `.in[${destPort}]`
    }

    // Only include js_id if wire has a valid ID
    const jsIdParam = wire.id && wire.id !== 'undefined' ? `, js_id="${wire.id}"` : ''
    return `${circuitVarName}.connect(${sourceExpr}, ${destExpr}${jsIdParam})    ${comment}`
  }

  // Legacy generateConnection function removed - replaced by generateConnectionWithComponents

  /**
   * Generate a GGL program for a circuit component (without run() call)
   */
  function generateGglProgramForCircuitComponent(circuit, circuitManager) {
    // Generate the GGL code for this circuit (without run() call for components)
    const result = generateGglProgram(
      circuit.components,
      circuit.wires,
      circuit.wireJunctions,
      {}, // componentRefs - not needed when using factory approach
      {}, // componentInstances - not needed when using factory approach
      circuitManager,
      false, // Don't include run() call for component modules
      circuit.name // Pass circuit name for error context
    )
    // For now, just return the code part for backward compatibility
    return result.code
  }

  /**
   * Wrap a GGL program as an importable Python component module
   */
  function wrapGglProgramAsComponentModule(componentName, gglProgram, requiredImports) {
    const pyComponentName = toPythonIdentifier(componentName)
    return `from ggl import arithmetic, circuit, logic, io, wires, plexers

# Import other components this circuit uses
${requiredImports}

# Build the circuit
${gglProgram}

# Export as a reusable component
${pyComponentName} = circuit.Component(circuit0)
`
  }

  /**
   * Find all component imports required by a circuit
   */
  function findRequiredComponentImports(components, circuitManager, excludeComponentName = null) {
    const imports = new Set()

    components.forEach(comp => {
      if (comp.type === 'schematic-component') {
        const circuitId = comp.props?.circuitId || comp.circuitId
        const componentDef = circuitManager.getComponentDefinition(circuitId)
        if (componentDef && componentDef.name !== excludeComponentName) {
          const pyName = toPythonIdentifier(componentDef.name)
          imports.add(`from ${pyName} import ${pyName}`)
        }
      }
    })

    return Array.from(imports).join('\n')
  }

  return {
    generateGglProgram,
    generateGglProgramForCircuitComponent,
    wrapGglProgramAsComponentModule,
    findRequiredComponentImports
  }
}
