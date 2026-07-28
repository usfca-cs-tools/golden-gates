import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileService } from './useFileService'
import { usePythonEngine } from './usePythonEngine'

/**
 * Circuit Operations - Business logic for circuit management
 * Provides controller layer functionality for circuit operations
 */
export function useAppController(circuitManager) {
  const { t } = useI18n()
  const {
    buildCircuitData,
    saveCircuit: saveCircuitFile,
    openProject: openProjectDir,
    readCircuitFile,
    parseAndValidateJSON
  } = useFileService()
  const {
    initialize: initializePyodide,
    runPython,
    isLoading: isPyodideLoading,
    isReady: isPyodideReady,
    error: pyodideError,
    pyodide,
    executeHierarchicalCircuit,
    stopSimulation
  } = usePythonEngine()

  // Simulation state
  const isRunning = ref(false)

  // Confirmation dialog state
  const showConfirmDialog = ref(false)
  const confirmDialog = ref({
    title: '',
    message: '',
    type: 'warning',
    acceptCallback: null,
    rejectCallback: null
  })

  /**
   * Create a new circuit with auto-generated name
   */
  function createNewCircuit() {
    const circuitCount = circuitManager.allCircuits.value.size + 1
    circuitManager.createCircuit(`Circuit${circuitCount}`)
  }

  /**
   * Run simulation on the current circuit with support for hierarchical circuits
   */
  async function runCircuitSimulationWithHierarchy(canvasRef) {
    isRunning.value = true

    // Clear any existing error notifications when starting a new simulation
    if (canvasRef?.clearAllNotifications) {
      canvasRef.clearAllNotifications()
    }

    // Clear component error states from previous Pyodide errors
    if (canvasRef?.components) {
      canvasRef.components.forEach(component => {
        if (component.props?.hasError || component.props?.hasWarning) {
          const clearedComponent = {
            ...component,
            props: {
              ...component.props,
              hasError: false,
              hasWarning: false,
              errorMessageId: '',
              errorDetails: {}
            }
          }
          canvasRef.updateComponent(clearedComponent)
        }
      })
    }

    try {
      // Open inputs are caught by the engine now: the codegen declares every
      // component (wired via connect(), unwired via add_orphan()), and
      // Circuit.preflight() raises inputNotConnected for any open input port
      // before settling — surfaced through the same structured-error path as
      // bit-width mismatches (component highlight + message), one at a time.

      // Initialize Pyodide if not already initialized
      if (!isPyodideReady.value) {
        await initializePyodide()
      }

      // Generate GGL program for the current circuit
      const mainCircuitGglProgram = generateGglProgramForCurrentCircuit(canvasRef)

      if (!mainCircuitGglProgram || mainCircuitGglProgram.trim() === '') {
        return
      }

      // Log the generated GGL program for debugging and verification
      console.log('\n=== Main Circuit GGL Program ===')
      console.log(mainCircuitGglProgram)
      console.log('=== End of Main Circuit ===\n')

      // Set up callback for Python to update Vue components
      setupPythonVueUpdateCallback(canvasRef)

      // Execute the complete hierarchical circuit program
      await executeHierarchicalCircuit(circuitManager, mainCircuitGglProgram)
    } catch (err) {
      console.error('Hierarchical circuit simulation error:', err)

      // Check if we have structured error data from Python
      const structuredErrorData = window.__vueStructuredErrorData
      if (structuredErrorData) {
        // Handle circuit component error with structured data
        handleCircuitComponentError(canvasRef, structuredErrorData)
        // Clear the structured error data
        window.__vueStructuredErrorData = null
      } else {
        // Non-CircuitError exception - show generic error
        if (canvasRef?.showErrorNotification) {
          canvasRef.showErrorNotification(`Simulation error: ${err.message}`)
        }
      }
    } finally {
      isRunning.value = false
    }
  }

  /**
   * Generate GGL program for the current circuit (with hierarchical support)
   */
  function generateGglProgramForCurrentCircuit(canvasRef) {
    if (!canvasRef) {
      console.error('No canvas reference provided to generateGglProgramForCurrentCircuit')
      return ''
    }

    if (typeof canvasRef.getCircuitData !== 'function') {
      console.error('Canvas reference does not have getCircuitData method')
      return ''
    }

    return canvasRef.getCircuitData()
  }

  /**
   * Set up the callback for Python to update Vue components
   */
  function setupPythonVueUpdateCallback(canvasRef) {
    // Callback for structured error data from Python
    window.__vueStructuredErrorCallback = errorJson => {
      try {
        // Parse JSON string to avoid Pyodide proxy issues
        window.__vueStructuredErrorData = JSON.parse(errorJson)
      } catch (e) {
        console.error('Failed to parse structured error data:', e)
        window.__vueStructuredErrorData = null
      }
    }

    // Apply one update to the canvas / reactive state.
    const applyUpdate = (eventType, componentId, value) => {
      if (!canvasRef) {
        console.error('No canvasRef available')
        return
      }

      const component = canvasRef.components.find(c => c.id === componentId)

      if (component) {
        switch (eventType) {
          case 'value':
            handleValueUpdate(canvasRef, component, value)
            break
          case 'step':
            handleStepUpdate(canvasRef, component, value)
            break
          case 'error':
            handleErrorUpdate(canvasRef, component, value)
            break
          case 'memory':
            handleMemoryUpdate(canvasRef, component, value)
            break
          case 'test':
            handleTestUpdate(canvasRef, component, value)
            break
          default:
            console.warn(`Unknown event type: ${eventType}`)
        }
      } else {
        const wireIdPattern = /^wire_\d+$/
        if (wireIdPattern.test(componentId) && eventType === 'step') {
          handleWireStepUpdate(canvasRef, componentId, value)
        } else if (eventType === 'error') {
          console.log(`Nested component error: ${componentId} = ${value} (no parent mapped)`)
        }
      }
    }

    // Pyodide passes dicts/lists as proxies; convert to plain JS once here.
    const toNative = v =>
      v && typeof v.toJs === 'function' ? v.toJs({ dict_converter: Object.fromEntries }) : v

    window.__vueUpdateCallback = (eventType, componentId, value) => {
      try {
        if (eventType === 'batch') {
          // value is a JSON string of [event, js_id, payload] coalesced by one settle().
          for (const [event, jid, payload] of JSON.parse(value)) {
            applyUpdate(event, jid, payload)
          }
          return
        }
        applyUpdate(eventType, componentId, toNative(value))
      } catch (e) {
        console.error('updateCallback failed:', eventType, e)
      }
    }

    // Handle legacy callback format for backward compatibility
    window.__vueUpdateCallbackLegacy = (componentId, value) => {
      window.__vueUpdateCallback('value', componentId, value)
    }
  }

  /**
   * Handle value update events
   */
  function handleValueUpdate(canvasRef, component, value) {
    if (component.type === 'output') {
      // Create a new component object with updated timestamp to force animation
      const updatedComponent = {
        ...component,
        props: {
          ...component.props,
          value: value,
          lastUpdate: Date.now()
        }
      }
      canvasRef.updateComponent(updatedComponent)
    }
  }

  /**
   * Handle Test evaluation results.
   * Payload: { label, passed, failures, errors }. Drive the Test component's
   * pass/fail badge and stash failures/errors for a tooltip.
   */
  function handleTestUpdate(canvasRef, component, result) {
    if (component.type !== 'test') return

    // Just the pass/fail badge. Failure/error DETAIL is surfaced through the
    // shared structured-error path (handleCircuitComponentError), same as
    // open-input and bit-width errors — the engine raises a CircuitError.
    const passed = !!(result && result.passed)
    canvasRef.updateComponent({
      ...component,
      props: { ...component.props, status: passed ? 'pass' : 'fail', lastUpdate: Date.now() }
    })
  }

  /**
   * Handle step highlighting events
   */
  function handleStepUpdate(canvasRef, component, stepData) {
    // For now, treat stepData as a boolean for active/inactive
    // Future: could be an object with { active: true, style: 'processing', duration: 500 }
    const isActive = typeof stepData === 'boolean' ? stepData : stepData.active

    const updatedComponent = {
      ...component,
      props: {
        ...component.props,
        stepActive: isActive,
        stepStyle: stepData.style || 'processing',
        stepDuration: stepData.duration || 500
      }
    }
    canvasRef.updateComponent(updatedComponent)

    // Auto-clear step highlighting after duration
    if (isActive) {
      const duration = stepData.duration || 500
      setTimeout(() => {
        const latestComponent = canvasRef.components.find(c => c.id === component.id)
        if (latestComponent) {
          const clearedComponent = {
            ...latestComponent,
            props: {
              ...latestComponent.props,
              stepActive: false
            }
          }
          canvasRef.updateComponent(clearedComponent)
        }
      }, duration)
    }
  }

  /**
   * Handle wire step update events
   */
  function handleWireStepUpdate(canvasRef, wireId, stepData) {
    const activeCircuit = canvasRef?.circuitManager?.activeCircuit?.value
    if (!activeCircuit?.wires) return

    const wireIndex = activeCircuit.wires.findIndex(w => w.id === wireId)
    if (wireIndex === -1) return

    // Convert Pyodide Proxy and extract data
    const jsStepData = stepData.toJs?.() || stepData

    // Update wire state directly
    activeCircuit.wires.splice(wireIndex, 1, {
      ...activeCircuit.wires[wireIndex],
      stepActive: jsStepData.active,
      stepStyle: jsStepData.style || 'processing'
    })
  }

  /**
   * Handle CircuitComponentError exceptions from Python
   */
  function handleCircuitComponentError(canvasRef, errorData) {
    if (!canvasRef) {
      console.error('No canvasRef available')
      return
    }

    // If we have circuit context, navigate to that circuit to show the error in context
    if (errorData.circuit_name) {
      // Find the circuit by name
      const targetCircuit = circuitManager.circuitsArray.value.find(
        c => c.name === errorData.circuit_name
      )
      if (targetCircuit && targetCircuit.id !== circuitManager.activeTabId.value) {
        circuitManager.navigateToCircuit(targetCircuit.id)
        // Give the UI a moment to switch circuits, then handle error with the now-active circuit
        setTimeout(() => {
          handleErrorInTargetCircuit(canvasRef, errorData)
        }, 200) // Single attempt with reasonable delay
        return
      }
    }

    // Handle error in current context (either no circuit name or already in target circuit)
    handleErrorInTargetCircuit(canvasRef, errorData)
  }

  function handleErrorInTargetCircuit(canvasRef, errorData) {
    // Find the component that has the error - try canvasRef first, fall back to active circuit data
    let component = null
    let componentsSource = null

    // First try canvasRef (normal case or if still valid after navigation)
    if (canvasRef?.components) {
      componentsSource = canvasRef.components

      // Try to find by component ID
      if (errorData.component_id) {
        component = componentsSource.find(c => c.id === errorData.component_id)
      }
    }

    // If not found in canvasRef, try active circuit data (post-navigation case)
    if (!component && circuitManager?.activeCircuit?.value?.components) {
      componentsSource = circuitManager.activeCircuit.value.components

      // Try to find by component ID
      if (errorData.component_id) {
        component = componentsSource.find(c => c.id === errorData.component_id)
      }
    }

    if (!component) {
      console.warn(`Component not found: ${errorData.component_id || 'no component_id'}`)

      // Show notification even if component not found (subcircuit error case)
      if (canvasRef?.showErrorNotification) {
        const circuitContext = errorData.circuit_name
          ? ` in circuit "${errorData.circuit_name}"`
          : ''
        const componentDescription = `${errorData.component_type}${circuitContext}`

        // Build template variables from error data for i18n
        const templateVars = {
          inputName: errorData.port_name || 'unknown',
          outputName: errorData.port_name || 'unknown',
          ...errorData // Include all additional fields (expectedBits, actualBits, etc.)
        }

        const errorMessage = t(`simulation.errors.${errorData.error_code}`, templateVars)
        canvasRef.showErrorNotification(`Error in ${componentDescription}: ${errorMessage}`)
      }
      return
    }

    // Create error details from all structured error data
    const errorDetails = {
      portName: errorData.port_name,
      connectedComponentId: errorData.connected_component_id,
      // Include any additional fields (expectedBits, actualBits, etc.)
      ...Object.fromEntries(
        Object.entries(errorData).filter(
          ([key]) =>
            ![
              'component_id',
              'component_type',
              'error_code',
              'severity',
              'port_name',
              'connected_component_id',
              'circuit_name'
            ].includes(key)
        )
      )
    }

    // Update component to show error state
    const updatedComponent = {
      ...component,
      props: {
        ...component.props,
        hasError: errorData.severity === 'error',
        hasWarning: errorData.severity === 'warning',
        errorMessageId: errorData.error_code,
        errorDetails: errorDetails
      }
    }

    // Use circuitManager.updateComponent if canvasRef is stale (post-navigation)
    if (canvasRef?.updateComponent) {
      canvasRef.updateComponent(updatedComponent)
    } else if (circuitManager?.updateComponent) {
      circuitManager.updateComponent(updatedComponent)
    }

    // Show global error notification - try canvasRef first, fall back to console if stale
    const componentLabel = component.props?.label || component.label
    const circuitContext = errorData.circuit_name ? ` in circuit "${errorData.circuit_name}"` : ''
    const componentDescription = componentLabel
      ? `${errorData.component_type} "${componentLabel}"${circuitContext}`
      : `${errorData.component_type}${circuitContext}`

    // Build template variables from error data
    const templateVars = {
      inputName: errorData.port_name || 'unknown',
      outputName: errorData.port_name || 'unknown',
      ...errorData // Include all additional fields (expectedBits, actualBits, etc.)
    }

    const errorMessage = t(`simulation.errors.${errorData.error_code}`, templateVars)

    if (canvasRef?.showErrorNotification) {
      canvasRef.showErrorNotification(`Error in ${componentDescription}: ${errorMessage}`)
    } else {
      // Fallback when canvasRef is stale - at least log the error
      console.error(`Error in ${componentDescription}: ${errorMessage}`)
    }
  }

  /**
   * Handle error events
   */
  function handleErrorUpdate(canvasRef, component, errorData) {
    // For now, treat errorData as a simple error message string
    // Future: could be an object with { severity: 'error', messageId: 'INPUT_NOT_CONNECTED', details: {} }
    const isError = typeof errorData === 'string' || errorData.severity === 'error'

    const updatedComponent = {
      ...component,
      props: {
        ...component.props,
        hasError: isError,
        hasWarning: errorData.severity === 'warning',
        errorMessageId: errorData.messageId || errorData,
        errorDetails: errorData.details || {}
      }
    }
    canvasRef.updateComponent(updatedComponent)

    // Show global error notification using the same system as front-end errors
    if (isError && canvasRef?.showErrorNotification) {
      const componentLabel = component.props?.label || component.label || 'unlabeled'
      const errorMessage =
        typeof errorData === 'string'
          ? errorData
          : errorData.message || `Error in ${component.type} "${componentLabel}"`

      canvasRef.showErrorNotification(
        `Error in ${component.type} "${componentLabel}": ${errorMessage}`
      )
    }

    console.error(`Component ${component.id} error:`, errorData)
  }

  /**
   * Handle memory update events for RAM components
   */
  function handleMemoryUpdate(canvasRef, component, memoryData) {
    if (component.type !== 'ram') {
      console.warn(`Memory update for non-RAM component: ${component.type}`)
      return
    }

    // Convert Pyodide Proxy to JavaScript object if needed
    let jsMemoryData = memoryData
    if (memoryData && typeof memoryData.toJs === 'function') {
      jsMemoryData = memoryData.toJs()
    } else if (memoryData && memoryData.constructor && memoryData.constructor.name === 'PyProxy') {
      // Fallback for older Pyodide versions
      try {
        jsMemoryData = {
          address: memoryData.address,
          value: memoryData.value
        }
      } catch (e) {
        console.warn('Failed to extract data from Pyodide Proxy:', e)
        return
      }
    }

    // Extract address and value from the memory data
    const address = jsMemoryData.address
    const value = jsMemoryData.value

    if (address === undefined || value === undefined) {
      console.warn('Memory update missing address or value:', jsMemoryData)
      return
    }

    // Update the component's data array
    const updatedComponent = {
      ...component,
      props: {
        ...component.props,
        // Ensure data array exists and is large enough
        data: component.props.data || new Array(2 ** (component.props.addressBits || 4)).fill(0),
        lastMemoryUpdate: Date.now() // For potential animation triggers
      }
    }

    // Update the specific memory location
    updatedComponent.props.data[address] = value

    // Update the component in the canvas
    canvasRef.updateComponent(updatedComponent)
  }

  /**
   * Legacy simulation function for backwards compatibility
   */
  async function runSimulation(canvasRef) {
    return await runCircuitSimulationWithHierarchy(canvasRef)
  }


  /**
   * Save current circuit to file
   */
  async function saveCircuit(canvasRef) {
    try {
      const components = canvasRef?.components || []
      const wires = canvasRef?.wires || []
      const wireJunctions = canvasRef?.wireJunctions || []

      // Get circuit metadata from the current active circuit
      const activeCircuit = circuitManager.activeCircuit.value
      const circuitMetadata = activeCircuit
        ? {
            name: activeCircuit.name,
            label: activeCircuit.label,
            // Only include interface from properties, not duplicate name/label
            interface: activeCircuit.properties?.interface
          }
        : {}

      // Collect ALL available schematic component definitions (not just used ones)
      // This ensures that components saved with "Save as Component" are preserved
      const allSchematicComponents = {}

      // Include all components from availableComponents Map
      for (const [circuitId, componentDef] of circuitManager.availableComponents.value) {
        if (componentDef && componentDef.type === 'circuit-component') {
          // Get the full circuit definition
          const circuit = circuitManager.getCircuit(circuitId)
          if (circuit) {
            allSchematicComponents[circuitId] = {
              definition: componentDef,
              circuit: circuit
            }
          }
        }
      }

      const projectDir = circuitManager.currentProjectDir.value
      const nextCircuitId = circuitManager.exportState().nextCircuitId

      if (projectDir && activeCircuit) {
        const filename = `${activeCircuit.name}.ggc`
        const circuitData = buildCircuitData(
          components,
          wires,
          wireJunctions,
          circuitMetadata,
          allSchematicComponents,
          nextCircuitId
        )
        const jsonString = JSON.stringify(circuitData, null, 2)
        await window.electronAPI.writeCircuitFile(projectDir, filename, jsonString)

        if (!circuitManager.projectCircuitFiles.value.includes(filename)) {
          circuitManager.projectCircuitFiles.value = [
            ...circuitManager.projectCircuitFiles.value,
            filename
          ]
        }
      } else {
        await saveCircuitFile(
          components,
          wires,
          wireJunctions,
          circuitMetadata,
          allSchematicComponents,
          nextCircuitId
        )
      }

      if (activeCircuit) {
        circuitManager.markCircuitAsSaved(activeCircuit.id)
      }
    } catch (error) {
      console.error('Error saving circuit:', error)
      alert('Error saving circuit: ' + error.message)
    }
  }

  async function openProject(canvasRef, dirPath = null) {
    try {
      const project = await openProjectDir(dirPath)
      if (!project) return  // user cancelled
  
      const { dirPath: resolvedDirPath, topLevelFilename, topLevelContent, allFiles } = project

      // Store project state on circuitManager
      circuitManager.currentProjectDir.value = resolvedDirPath
      circuitManager.projectCircuitFiles.value = allFiles
  
      const hasExistingWork = canvasRef?.components?.length > 0 || canvasRef?.wires?.length > 0
  
      const doLoad = () => {
        if (topLevelContent) {
          // Parse and load the top-level circuit
          const circuitData = parseAndValidateJSON(topLevelContent)
          loadCircuitData(canvasRef, circuitData)
        } else {
          // Empty repo — create a blank circuit named after the top-level file
          const circuitName = topLevelFilename.replace('.ggc', '')
          circuitManager.createCircuit(circuitName)
        }
      }
  
      if (hasExistingWork) {
        showConfirmation({
          title: 'Open Project?',
          message: 'This will replace your current work. Are you sure?',
          type: 'warning',
          onAccept: doLoad
        })
      } else {
        doLoad()
      }
    } catch (error) {
      console.error('Error opening project:', error)
      alert('Error opening project: ' + error.message)
    }
  }



  /**
   * Load circuit file data into a specific subcircuit tab (preserves circuit ID)
   */
  function loadSubcircuitData(canvasRef, circuitId, circuitData) {
    if (!canvasRef) return

    circuitManager.navigateToCircuit(circuitId)

    if (canvasRef.setLoadingState) {
      canvasRef.setLoadingState(true)
    }

    if (
      circuitData.schematicComponents &&
      Object.keys(circuitData.schematicComponents).length > 0
    ) {
      Object.entries(circuitData.schematicComponents).forEach(([nestedId, data]) => {
        try {
          if (data.circuit) {
            circuitManager.allCircuits.value.set(nestedId, {
              ...data.circuit,
              id: nestedId
            })
          }
          if (data.definition) {
            circuitManager.availableComponents.value.set(nestedId, data.definition)
          }
        } catch (error) {
          console.warn(`Failed to restore schematic component ${nestedId}:`, error)
        }
      })
    }

    if (circuitData.nextCircuitId) {
      const currentState = circuitManager.exportState()
      currentState.nextCircuitId = Math.max(currentState.nextCircuitId, circuitData.nextCircuitId)
      circuitManager.importState(currentState)
    }

    const targetCircuit = circuitManager.getCircuit(circuitId)
    if (!targetCircuit) {
      if (canvasRef.setLoadingState) {
        canvasRef.setLoadingState(false)
      }
      return
    }

    if (circuitData.name) {
      targetCircuit.name = circuitData.name
    }
    if (circuitData.label) {
      targetCircuit.label = circuitData.label
    }
    if (circuitData.interface) {
      targetCircuit.properties = targetCircuit.properties || {}
      targetCircuit.properties.interface = circuitData.interface
    }

    canvasRef.clearCircuit()

    if (circuitData.components) {
      circuitData.components.forEach(component => {
        canvasRef.loadComponent(component)
      })
    }

    if (circuitData.wires) {
      circuitData.wires.forEach(wire => {
        canvasRef.addWire(wire)
      })
    }

    if (circuitData.wireJunctions) {
      circuitData.wireJunctions.forEach(junction => {
        canvasRef.addWireJunction(junction)
      })
    }

    if (canvasRef.setLoadingState) {
      canvasRef.setLoadingState(false)
    }
  }

  /**
   * Open a subcircuit tab — load from project disk file when available
   */
  async function openSubcircuitTab(canvasRef, circuitId) {
    const circuit = circuitManager.getCircuit(circuitId)
    if (!circuit) {
      console.warn(`Circuit ${circuitId} not found`)
      return false
    }

    const projectDir = circuitManager.currentProjectDir.value
    const projectFiles = circuitManager.projectCircuitFiles.value

    if (!projectDir || !window.electronAPI) {
      circuitManager.navigateToCircuit(circuitId)
      return true
    }

    const filename = `${circuit.name}.ggc`
    const fileExists = projectFiles.includes(filename)

    circuitManager.navigateToCircuit(circuitId)

    if (fileExists) {
      try {
        const content = await readCircuitFile(projectDir, filename)
        if (content) {
          const circuitData = parseAndValidateJSON(content)
          loadSubcircuitData(canvasRef, circuitId, circuitData)
          circuitManager.markCircuitAsSaved(circuitId)
        }
      } catch (error) {
        console.error('Error reading subcircuit file:', error)
        alert('Error reading circuit file: ' + error.message)
      }
    }

    return true
  }

  /**
   * Load circuit data into canvas
   */
  function loadCircuitData(canvasRef, circuitData) {
    if (!canvasRef) return

    // Set loading state to prevent undo saves during loading
    if (canvasRef.setLoadingState) {
      canvasRef.setLoadingState(true)
    }

    // Clear existing circuit canvas
    canvasRef.clearCircuit()

    // For v1.1+ format, restore schematic component definitions first
    if (
      circuitData.schematicComponents &&
      Object.keys(circuitData.schematicComponents).length > 0
    ) {
      Object.entries(circuitData.schematicComponents).forEach(([circuitId, data]) => {
        try {
          // Restore the circuit definition
          if (data.circuit) {
            // Always restore circuit data (overwrite existing if needed)
            const circuit = {
              ...data.circuit,
              id: circuitId
            }
            circuitManager.allCircuits.value.set(circuitId, circuit)
          }

          // Restore the component definition
          if (data.definition) {
            circuitManager.availableComponents.value.set(circuitId, data.definition)
          }
        } catch (error) {
          console.warn(`Failed to restore schematic component ${circuitId}:`, error)
        }
      })
    }

    // Restore nextCircuitId to prevent ID collisions
    if (circuitData.nextCircuitId) {
      // Get current state, update nextCircuitId, and restore it
      const currentState = circuitManager.exportState()
      currentState.nextCircuitId = Math.max(currentState.nextCircuitId, circuitData.nextCircuitId)
      circuitManager.importState(currentState)
    }

    // Ensure we're loading into the correct circuit context
    // Create a new circuit or use the active circuit appropriately
    let targetCircuit = circuitManager.activeCircuit.value

    // If the loaded circuit has a different name than the active circuit,
    // we should create a new circuit or rename the active circuit
    if (targetCircuit && circuitData.name && circuitData.name !== targetCircuit.name) {
      // Check if any of the schematic components reference the current active circuit
      const hasConflict = circuitData.components?.some(component => {
        if (component.type === 'schematic-component') {
          const circuitId = component.props?.circuitId || component.circuitId
          return circuitId === targetCircuit.id
        }
        return false
      })

      if (hasConflict) {
        // Create a new circuit for the loaded data to avoid conflicts
        const newCircuitName = circuitData.name || `Circuit${Date.now()}`
        targetCircuit = circuitManager.createCircuit(newCircuitName, {
          label: circuitData.label || newCircuitName
        })
      }
    }

    // Apply circuit properties to the target circuit
    if (targetCircuit) {
      if (circuitData.name) {
        targetCircuit.name = circuitData.name
      }
      if (circuitData.label) {
        targetCircuit.label = circuitData.label
      }
      if (circuitData.interface) {
        targetCircuit.properties = targetCircuit.properties || {}
        targetCircuit.properties.interface = circuitData.interface
      }
    }

    // Load components
    if (circuitData.components) {
      circuitData.components.forEach(component => {
        canvasRef.loadComponent(component)
      })
    }

    // Load wires
    if (circuitData.wires) {
      circuitData.wires.forEach(wire => {
        canvasRef.addWire(wire)
      })
    }

    // Load wire junctions
    if (circuitData.wireJunctions) {
      circuitData.wireJunctions.forEach(junction => {
        canvasRef.addWireJunction(junction)
      })
    }

    // Reset loading state
    if (canvasRef.setLoadingState) {
      canvasRef.setLoadingState(false)
    }
  }

  /**
   * Handle drag and drop of circuit files
   */
  async function handleDroppedFile(canvasRef, file) {
    try {
      const fileContent = await file.text()
      const circuitData = parseAndValidateJSON(fileContent)

      // Check if current circuit has any components
      const hasExistingCircuit = canvasRef?.components?.length > 0 || canvasRef?.wires?.length > 0

      if (hasExistingCircuit) {
        showConfirmation({
          title: 'Replace Circuit?',
          message: 'This will replace your current circuit. Are you sure you want to continue?',
          type: 'warning',
          onAccept: () => {
            // Complete replacement: clear all schematic components to prevent ID conflicts
            circuitManager.availableComponents.value.clear()

            // Also clear any other circuits that might have conflicting IDs
            // Keep only the currently active circuit, but clear its contents
            const activeCircuitId = circuitManager.activeTabId.value
            if (activeCircuitId) {
              const activeCircuit = circuitManager.getCircuit(activeCircuitId)
              if (activeCircuit) {
                // Clear all other circuits except the active one
                for (const [circuitId] of circuitManager.allCircuits.value) {
                  if (circuitId !== activeCircuitId) {
                    circuitManager.allCircuits.value.delete(circuitId)
                  }
                }
              }
            }

            loadCircuitData(canvasRef, circuitData)
          }
        })
      } else {
        // Complete replacement even when no existing circuit
        circuitManager.availableComponents.value.clear()

        const activeCircuitId = circuitManager.activeTabId.value
        if (activeCircuitId) {
          const activeCircuit = circuitManager.getCircuit(activeCircuitId)
          if (activeCircuit) {
            for (const [circuitId] of circuitManager.allCircuits.value) {
              if (circuitId !== activeCircuitId) {
                circuitManager.allCircuits.value.delete(circuitId)
              }
            }
          }
        }

        loadCircuitData(canvasRef, circuitData)
      }
    } catch (error) {
      console.error('Error loading dropped file:', error)
      alert('Error loading circuit: ' + error.message)
    }
  }

  /**
   * Show confirmation dialog
   */
  function showConfirmation({
    title,
    message,
    type = 'warning',
    acceptLabel,
    showCancel,
    onAccept,
    onReject
  }) {
    confirmDialog.value = {
      title,
      message,
      type,
      acceptLabel,
      showCancel,
      acceptCallback: onAccept || (() => {}),
      rejectCallback: onReject || (() => {})
    }
    showConfirmDialog.value = true
  }

  /**
   * Check if there's unsaved work
   */
  function hasUnsavedWork(canvasRef) {
    // Check if there are any components or wires in the circuit
    // components and wires are direct reactive properties, not computed refs
    const components = canvasRef?.components || []
    const wires = canvasRef?.wires || []
    return components.length > 0 || wires.length > 0
  }

  /**
   * Handle inspector action events
   */
  function handleInspectorAction(event) {
    const { action, circuit } = event

    switch (action) {
      case 'saveAsComponent':
        if (circuit) {
          const success = circuitManager.saveCircuitAsComponent(circuit.id)
        }
        break

      case 'deleteComponent':
        if (circuit) {
          // Check if this circuit is saved as a component
          const isComponent = Array.from(circuitManager.availableComponents.value.values()).some(
            comp => comp.circuitId === circuit.id
          )

          if (isComponent) {
            // Show confirmation dialog
            showConfirmation({
              title: 'Delete Component',
              message: `Are you sure you want to delete the component "${circuit.name || circuit.label}"? This will remove it from the available components list.`,
              type: 'warning',
              acceptLabel: 'Delete',
              showCancel: true,
              onAccept: () => {
                // Delete the component
                circuitManager.removeCircuitComponent(circuit.id)
              }
            })
          } else {
            console.warn('This circuit is not saved as a component')
          }
        }
        break

      default:
        console.warn('Unknown inspector action:', action)
    }
  }

  return {
    // Simulation state
    isRunning,
    isPyodideLoading,
    isPyodideReady,
    pyodideError,
    pyodide,

    // Confirmation dialog
    showConfirmDialog,
    confirmDialog,

    // Circuit operations
    createNewCircuit,
    runSimulation,
    runCircuitSimulationWithHierarchy,
    stopSimulation,
    saveCircuit,
    openProject,
    loadCircuitData,
    loadSubcircuitData,
    openSubcircuitTab,
    handleDroppedFile,
    handleInspectorAction,

    // Utility functions
    showConfirmation,
    hasUnsavedWork
  }
}
