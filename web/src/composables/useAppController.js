import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileService } from './useFileService'
import { usePythonEngine } from './usePythonEngine'

// Errors whose message is already a full, self-contained sentence (naming the circuit, the
// port, and the fix). The notification shows these verbatim rather than wrapping them in the
// generic "Error in <component> in circuit X: " prefix, which would just repeat the context.
const SELF_CONTAINED_ERROR_CODES = new Set(['portNotFullyConnected'])

/**
 * A circuit's runtime id, derived from its filename. Making the id a pure function of the
 * filename means it's STABLE across loads (a reload can't reshuffle ids the way the old
 * `circuit_${n++}` counter did) and the generated GGL reads `sub_register_8_bit` instead of
 * `sub_circuit_2`. Sanitize to a valid identifier; if two filenames sanitize to the same base
 * (e.g. `a-b` and `a_b`), pass a `used` set to get a deterministic-within-load suffix.
 */
export function deriveCircuitId(filename, used = null) {
  const base =
    String(filename || 'circuit')
      .replace(/\.ggc$/i, '')
      .replace(/[^0-9a-zA-Z_]/g, '_') || 'circuit'
  if (!used) return base
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}_${n++}`
  used.add(id)
  return id
}

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
    executePythonProgram,
    generateProgramFromModel,
    stopSimulation,
    stepClock: stepClockEngine
  } = usePythonEngine()

  // Simulation state
  const isRunning = ref(false)
  // True only while a Run Tests pass is in flight (a subset of isRunning), so the loading
  // indicator can say "Running tests..." instead of the generic "Running simulation...".
  const isRunningTests = ref(false)

  // Advance a manual clock by one edge. Only meaningful while a simulation is running (the
  // engine's tick() is a no-op otherwise, but gating here avoids poking a stopped circuit0).
  function stepClock() {
    if (!isRunning.value) return
    stepClockEngine()
  }

  // Persist which circuits are open (vs. closed-but-reopenable) per project, so the tab layout
  // survives across runs. Keyed by project dir; stored by sourceFilename since circuit ids are
  // reassigned each load. `restoringTabs` suppresses the watcher while openProject rebuilds tabs.
  let restoringTabs = false
  const openTabsKey = dir => `gg.openTabs:${dir}`
  function loadOpenTabState(dir) {
    try {
      const raw = localStorage.getItem(openTabsKey(dir))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  function saveOpenTabState() {
    const dir = circuitManager.currentProjectDir?.value
    if (!dir) return
    try {
      const filenames = (circuitManager.openTabs?.value || [])
        .map(t => circuitManager.getCircuit?.(t.id)?.sourceFilename)
        .filter(Boolean)
      localStorage.setItem(openTabsKey(dir), JSON.stringify(filenames))
    } catch {
      // localStorage may be unavailable; the closed state just won't persist this run.
    }
  }
  watch(
    () => (circuitManager.openTabs?.value || []).map(t => t.id).join('|'),
    () => {
      if (!restoringTabs) saveOpenTabState()
    }
  )

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
  // A filename-derived id that's unique against the circuits already in memory. Used when
  // creating a circuit that isn't coming from the openProject batch, so new circuits get the
  // same stable, readable id scheme as loaded ones instead of a `circuit_N` placeholder.
  function uniqueCircuitId(nameOrFilename) {
    return deriveCircuitId(nameOrFilename, new Set(circuitManager.allCircuits.value.keys()))
  }

  function createNewCircuit() {
    const circuitCount = circuitManager.allCircuits.value.size + 1
    const name = `Circuit${circuitCount}`
    circuitManager.createCircuit(name, { id: uniqueCircuitId(name) })
  }

  /**
   * Run simulation on the current circuit with support for hierarchical circuits
   */
  async function runCircuitSimulationWithHierarchy(canvasRef, mode = 'run') {
    // Run Tests on a circuit with no Test components is a no-op; tell the user
    // rather than silently doing nothing (a plain Run would run_async instead).
    if (mode === 'test') {
      const hasTests = (canvasRef?.components || []).some(c => c.type === 'test')
      if (!hasTests) {
        if (canvasRef?.showErrorNotification) {
          canvasRef.showErrorNotification(t('simulation.noTests'))
        }
        return
      }
    }

    isRunning.value = true
    isRunningTests.value = mode === 'test'

    // Clear any existing error notifications when starting a new simulation
    if (canvasRef?.clearAllNotifications) {
      canvasRef.clearAllNotifications()
    }

    // Clear component error states from previous Pyodide errors, and — when starting a test
    // run — reset stale pass/fail badges to 'pending' so the previous run's results don't
    // linger over the new one. Both are folded into one pass, touching only components that
    // actually carry stale state.
    if (canvasRef?.components) {
      const resetTestBadges = mode === 'test'
      canvasRef.components.forEach(component => {
        const hasErrorState = component.props?.hasError || component.props?.hasWarning
        const staleTestBadge =
          resetTestBadges &&
          component.type === 'test' &&
          component.props?.status &&
          component.props.status !== 'pending'
        if (!hasErrorState && !staleTestBadge) return

        canvasRef.updateComponent(
          {
            ...component,
            props: {
              ...component.props,
              ...(hasErrorState
                ? { hasError: false, hasWarning: false, errorMessageId: '', errorDetails: {} }
                : {}),
              ...(staleTestBadge ? { status: 'pending', lastUpdate: Date.now() } : {})
            }
          },
          { transient: true }
        )
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

      // Build the .ggc-shaped model (components with serialized port coordinates +
      // inlined subcircuits) and let ggl.view generate the GGL program from it in Pyodide
      // (pass 1); then exec that program (pass 2). Two passes so the generated program is a
      // plain, inspectable artifact in between. The front-end 'run' maps to run_async (the
      // browser's free-running clock + live inputs); 'test' evaluates each Test.
      const model = buildRunModel(canvasRef)
      // 'test_async' awaits the cooperative evaluate_async so a long clocked Test yields to the
      // event loop (responsive UI, live updates, working Stop) instead of freezing the tab.
      const gglMode = mode === 'test' ? 'test_async' : 'run_async'

      // Register the Python->Vue callbacks (including the structured-error channel) BEFORE
      // generation, since generateProgramFromModel can itself raise a structured CircuitError
      // (e.g. an invalid tunnel net) that we want surfaced the same way run-time errors are.
      setupPythonVueUpdateCallback(canvasRef)

      const program = await generateProgramFromModel(model, gglMode)

      if (!program || program.trim() === '') {
        return
      }

      // Log the generated GGL program for debugging. The console truncates the DISPLAY of a
      // very long single string (a circuit with big ROMs is hundreds of KB), so also stash the
      // full source on window — `copy(__ggl)` in DevTools grabs the whole thing.
      window.__ggl = program
      console.log(`\n=== ggl.view GGL Program (${program.length} chars) ===`)
      console.log(program)
      console.log('=== End of Program — full source at window.__ggl, e.g. copy(__ggl) ===\n')

      // Execute the generated program (ggl.view already inlined the hierarchy, so there
      // are no per-subcircuit MEMFS modules to write). Wire-highlight events are suppressed
      // for a batch test run — they'd flood the UI and hide the RAM/output updates the user
      // is actually watching — but kept for an interactive Run.
      await executePythonProgram(program, { stepHighlighting: mode !== 'test' })
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
      isRunningTests.value = false
    }
  }

  /**
   * Assemble the current circuit as a .ggc-shaped model dict for ggl.view: components
   * (each with its serialized port coordinates), wires, junctions, and ALL saved subcircuit
   * definitions inlined under schematicComponents. Mirrors the save path's assembly.
   */
  function buildRunModel(canvasRef) {
    // Annotation-only components (e.g. text labels) have no simulation ports —
    // exclude them so ggl.view doesn't encounter an unknown component type.
    const components = (canvasRef?.components || []).filter(c => c.type !== 'text')
    const wires = canvasRef?.wires || []
    const wireJunctions = canvasRef?.wireJunctions || []

    const activeCircuit = circuitManager.activeCircuit.value
    const circuitMetadata = activeCircuit ? metadataFor(activeCircuit) : {}

    const allSchematicComponents = {}
    for (const [circuitId, componentDef] of circuitManager.availableComponents.value) {
      if (componentDef && componentDef.type === 'circuit-component') {
        const circuit = circuitManager.getCircuit(circuitId)
        if (circuit) {
          allSchematicComponents[circuitId] = { definition: componentDef, circuit }
        }
      }
    }

    const nextCircuitId = circuitManager.exportState().nextCircuitId
    return buildCircuitData(
      components,
      wires,
      wireJunctions,
      circuitMetadata,
      allSchematicComponents,
      nextCircuitId,
      circuitManager,
      // Running (unlike saving) must honor the live input values on the canvas, or every
      // input starts at the engine default 0 until it's toggled.
      { keepInputValues: true }
    )
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
        if (componentId.startsWith('wire_') && eventType === 'step') {
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
      canvasRef.updateComponent(updatedComponent, { transient: true })
    }
  }

  /**
   * Handle Test evaluation results.
   *
   * A passing Test emits { label, passed: true }; a failing one emits the structured error
   * detail ({ error_code, ...fields }) from evaluate_async, which — unlike the synchronous
   * grading path — returns a fail result instead of raising so the Run Tests pass runs every
   * Test. We badge the component and, on failure, stack one localized toast per failing Test.
   */
  function handleTestUpdate(canvasRef, component, result) {
    if (component.type !== 'test') return

    const passed = !!(result && result.passed)

    // Pass/fail badge on the canvas (the TestNode renders from `status`).
    canvasRef.updateComponent(
      {
        ...component,
        props: { ...component.props, status: passed ? 'pass' : 'fail', lastUpdate: Date.now() }
      },
      { transient: true }
    )

    // Stack a toast per failing Test. Only the enriched fail event carries an error_code (the
    // bare passed:false badge event from the synchronous _raise does not), so a failure yields
    // exactly one toast. Since the pass no longer aborts at the first failure, each failing
    // Test adds its own notification to the stack.
    const errorCode = !passed ? result?.error_code : null
    if (errorCode && canvasRef?.showErrorNotification) {
      const label = component.props?.label || component.label
      const description = label ? `Test "${label}"` : 'Test'
      const templateVars = {
        inputName: result.port_name || 'unknown',
        outputName: result.port_name || 'unknown',
        ...result
      }
      const message = t(`simulation.errors.${errorCode}`, templateVars)
      canvasRef.showErrorNotification(
        SELF_CONTAINED_ERROR_CODES.has(errorCode) ? message : `Error in ${description}: ${message}`
      )
    }
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
    canvasRef.updateComponent(updatedComponent, { transient: true })

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
          canvasRef.updateComponent(clearedComponent, { transient: true })
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

    // Update wire state directly. value/bits (added for the bus-value hover tooltip,
    // issue #133) let Wire.vue show what a multi-bit bus is carrying; they mirror how an
    // Output stores props.value.
    activeCircuit.wires.splice(wireIndex, 1, {
      ...activeCircuit.wires[wireIndex],
      stepActive: jsStepData.active,
      stepStyle: jsStepData.style || 'processing',
      value: jsStepData.value,
      bits: jsStepData.bits
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
        canvasRef.showErrorNotification(
          SELF_CONTAINED_ERROR_CODES.has(errorData.error_code)
            ? errorMessage
            : `Error in ${componentDescription}: ${errorMessage}`
        )
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
      canvasRef.updateComponent(updatedComponent, { transient: true })
    } else if (circuitManager?.updateComponent) {
      circuitManager.updateComponent(updatedComponent, { transient: true })
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
    const notification = SELF_CONTAINED_ERROR_CODES.has(errorData.error_code)
      ? errorMessage
      : `Error in ${componentDescription}: ${errorMessage}`

    if (canvasRef?.showErrorNotification) {
      canvasRef.showErrorNotification(notification)
    } else {
      // Fallback when canvasRef is stale - at least log the error
      console.error(notification)
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
    canvasRef.updateComponent(updatedComponent, { transient: true })

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
    canvasRef.updateComponent(updatedComponent, { transient: true })
  }

  /**
   * Legacy simulation function for backwards compatibility
   */
  async function runSimulation(canvasRef) {
    return await runCircuitSimulationWithHierarchy(canvasRef, 'run')
  }

  /**
   * Run the circuit's Test components: evaluate each against the settled circuit,
   * badging pass/fail. Distinct from runSimulation so the two are explicit commands
   * (Run vs. Run Tests) rather than one command that guesses from circuit contents.
   */
  async function runTests(canvasRef) {
    return await runCircuitSimulationWithHierarchy(canvasRef, 'test')
  }

  /**
   * Save As: pick a new directory, update currentProjectDir, then save all circuits
   */
  async function saveCircuitAs(canvasRef) {
    const newDir = await window.electronAPI.pickProjectDirectory()
    if (!newDir) return
    circuitManager.currentProjectDir.value = newDir
    for (const [, circuit] of circuitManager.allCircuits.value) {
      if (!circuit.sourceFilename) {
        circuit.sourceFilename = `${circuit.name}.ggc`
      }
    }
    // Save As copies the whole project to the new folder, so write EVERY circuit — not just the
    // changed ones (the destination has none of them yet).
    await saveCircuit(canvasRef, { changedOnly: false })
  }

  /**
   * Save current circuit to file
   */
  async function saveCircuit(canvasRef, { changedOnly = true } = {}) {
    try {
      const components = canvasRef?.components || []
      const wires = canvasRef?.wires || []
      const wireJunctions = canvasRef?.wireJunctions || []

      // Get circuit metadata from the current active circuit
      const activeCircuit = circuitManager.activeCircuit.value
      const circuitMetadata = activeCircuit ? metadataFor(activeCircuit) : {}

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
        // Project mode: save each circuit to its own file (no schematicComponents embedding).
        for (const [, circuit] of circuitManager.allCircuits.value) {
          // Skip a circuit only if it's clean AND already on disk, so Save (⌘S) doesn't rewrite
          // unchanged files — but a never-saved (new) circuit, which may not be flagged dirty, is
          // always written. (Save As passes changedOnly:false to copy the whole project.)
          if (changedOnly && !circuit.hasUnsavedChanges && circuit.sourceFilename) continue
          const filename = circuit.sourceFilename || `${circuit.name}.ggc`
          const circuitMetadata = metadataFor(circuit)
          // Subcircuit refs are persisted by filename ONLY. circuitId is an in-memory,
          // filename-derived handle (re-derived on load), so we strip it from the file. The
          // filename comes from the referenced circuit's current sourceFilename, so a rename
          // still propagates to its parents.
          const componentsForSave = circuit.components.map(comp => {
            if (comp.type !== 'schematic-component') return comp
            const ref = circuitManager.allCircuits.value.get(comp.props?.circuitId)
            const { circuitId, ...props } = comp.props || {}
            const filename = ref?.sourceFilename || props.filename
            return { ...comp, props: { ...props, ...(filename ? { filename } : {}) } }
          })

          const circuitData = buildCircuitData(
            componentsForSave,
            circuit.wires,
            circuit.wireJunctions,
            circuitMetadata,
            {}, // no embedded sub-circuits — each has its own file
            circuitManager.exportState().nextCircuitId,
            circuitManager, // needed for computeComponentPorts (port serialization)
            { standalone: true } // ← omit schematicComponents block
          )
          const jsonString = JSON.stringify(circuitData, null, 2)
          await window.electronAPI.writeCircuitFile(projectDir, filename, jsonString)

          // Track new filenames
          if (!circuitManager.projectCircuitFiles.value.includes(filename)) {
            circuitManager.projectCircuitFiles.value = [
              ...circuitManager.projectCircuitFiles.value,
              filename
            ]
          }
          // Record the filename on the circuit for future saves
          circuit.sourceFilename = circuit.sourceFilename || filename

          // If the Filename field was edited, the new file is now written — remove the old one
          // so a renamed circuit doesn't leave its former file behind (which would reload as a
          // stale duplicate). Never delete a file another circuit still points at.
          const renamedFrom = circuit.renamedFromFilename
          if (renamedFrom && renamedFrom !== filename) {
            const stillUsed = [...circuitManager.allCircuits.value.values()].some(
              c => c !== circuit && c.sourceFilename === renamedFrom
            )
            if (!stillUsed) {
              await window.electronAPI.deleteCircuitFile?.(projectDir, renamedFrom)
              circuitManager.projectCircuitFiles.value =
                circuitManager.projectCircuitFiles.value.filter(f => f !== renamedFrom)
            }
          }
          circuit.renamedFromFilename = null

          circuitManager.markCircuitAsSaved(circuit.id)
        }
      } else {
        await saveCircuitFile(
          components,
          wires,
          wireJunctions,
          circuitMetadata,
          allSchematicComponents,
          nextCircuitId,
          null,
          circuitManager
        )
      }

      if (activeCircuit) {
        circuitManager.markCircuitAsSaved(activeCircuit.id)
      }
      // Report success so the save-on-quit flow can block quitting on a failed write.
      return true
    } catch (error) {
      console.error('Error saving circuit:', error)
      alert('Error saving circuit: ' + error.message)
      return false
    }
  }

  async function openProject(canvasRef, dirPath = null, activeFile = null) {
    try {
      const project = await openProjectDir(dirPath)
      if (!project) return

      const { dirPath: resolvedDirPath, topLevelFilename, allFiles } = project

      circuitManager.currentProjectDir.value = resolvedDirPath
      circuitManager.projectCircuitFiles.value = allFiles

      const hasExistingWork = canvasRef?.components?.length > 0 || canvasRef?.wires?.length > 0

      const doLoad = async () => {
        restoringTabs = true
        // Clear canvas and reset circuits
        canvasRef?.clearCircuit?.()
        circuitManager.allCircuits.value.clear()
        circuitManager.availableComponents.value.clear()
        circuitManager.openTabs.value = []

        // Load every .ggc file into memory
        const usedCircuitIds = new Set()
        for (const filename of allFiles) {
          try {
            const content = await readCircuitFile(resolvedDirPath, filename)
            if (!content) continue
            const circuitData = parseAndValidateJSON(content)

            // Create the circuit with a STABLE, filename-derived id (suppress auto-tab; we'll
            // open the top-level manually).
            const circuit = circuitManager.createCircuit(circuitData.name, {
              id: deriveCircuitId(filename, usedCircuitIds),
              sourceFilename: filename,
              hasUnsavedChanges: false,
              // Keep the file's generation so a 1.5 circuit keeps insertion-order ports.
              formatVersion: circuitData.version,
              openTab: false // don't auto-open every sub-circuit as a tab
            })

            // Populate directly — canvas reads reactively from allCircuits
            circuit.components = circuitData.components || []
            circuit.wires = circuitData.wires || []
            circuit.wireJunctions = circuitData.wireJunctions || []
            if (circuitData.label) circuit.label = circuitData.label
            if (circuitData.interface) {
              circuit.properties = circuit.properties || {}
              circuit.properties.interface = circuitData.interface
            }
            applyAppearance(circuit, circuitData)

            // Make available as a draggable component in the sidebar (for all files)
            circuitManager.saveCircuitAsComponent(circuit.id)
          } catch (err) {
            // An old-format file fails the whole open, loudly (the outer catch alerts).
            if (err?.code === 'UNSUPPORTED_VERSION') {
              err.message = `${filename}: ${err.message}`
              throw err
            }
            console.warn(`Failed to load ${filename}:`, err)
          }
        }

        // Resolve filename → circuitId cross-references
        resolveFilenameReferences()

        if (allFiles.length === 0) {
          // Empty repo — create blank circuit named after the directory
          const circuitName = topLevelFilename.replace('.ggc', '')
          circuitManager.createCircuit(circuitName, { id: uniqueCircuitId(circuitName) })
        } else {
          // Restore the previously open/closed set for this project (persisted across runs).
          // First time we see the project (no saved state) → open every circuit.
          const savedOpen = loadOpenTabState(resolvedDirPath)
          const toOpen = savedOpen ? allFiles.filter(f => savedOpen.includes(f)) : allFiles
          for (const filename of toOpen) {
            const circuit = circuitManager.getCircuitByFilename(filename)
            if (circuit) circuitManager.openTab(circuit.id)
          }
          // Focus the double-clicked file if provided, otherwise the top-level circuit — and
          // ensure it's open even if it had been closed last session.
          const focusFilename = activeFile || topLevelFilename
          const focusCircuit =
            circuitManager.getCircuitByFilename(focusFilename) ||
            circuitManager.getCircuitByFilename(topLevelFilename)
          if (focusCircuit) circuitManager.openTab(focusCircuit.id)
        }

        restoringTabs = false
        saveOpenTabState() // persist the initial/restored set for this project
      }

      if (hasExistingWork) {
        showConfirmation({
          title: 'Open Project?',
          message: 'This will replace your current work. Are you sure?',
          type: 'warning',
          onAccept: doLoad
        })
      } else {
        await doLoad()
      }
    } catch (error) {
      console.error('Error opening project:', error)
      alert('Error opening project: ' + error.message)
    }
  }

  /**
   * Walk every circuit in memory and resolve schematic-component filename props
   * to their current in-memory circuitId. Call this after all .ggc files are loaded.
   */
  function resolveFilenameReferences() {
    // Build name→circuit map for old-format files that have circuitId but no filename prop
    const circuitsByName = new Map()
    for (const [, circuit] of circuitManager.allCircuits.value) {
      circuitsByName.set(circuit.name, circuit)
    }

    for (const [, circuit] of circuitManager.allCircuits.value) {
      for (const comp of circuit.components || []) {
        if (comp.type !== 'schematic-component') continue

        if (comp.props?.filename) {
          // New format: resolve filename → current circuitId
          const referenced = circuitManager.getCircuitByFilename(comp.props.filename)
          if (referenced) {
            comp.props.circuitId = referenced.id
          } else {
            console.warn(
              `Cannot resolve schematic ref: "${comp.props.filename}" not found in project`
            )
          }
        } else if (comp.props?.label) {
          // Old format (no filename): fall back to matching by circuit name == label
          const referenced = circuitsByName.get(comp.props.label)
          if (referenced) {
            comp.props.circuitId = referenced.id
            comp.props.filename = referenced.sourceFilename || `${referenced.name}.ggc`
          } else {
            console.warn(
              `Cannot resolve schematic ref by name: "${comp.props.label}" not found in project`
            )
          }
        }
      }
    }
  }

  // Restore a circuit's per-definition appearance (color + manual size) from its .ggc into the
  // in-memory circuit.properties, where the inspector reads/writes it and SchematicComponent renders
  // it. A file that predates the feature simply has no `appearance` block → nothing to copy.
  function applyAppearance(circuit, circuitData) {
    if (!circuitData.appearance) return
    circuit.properties = circuit.properties || {}
    Object.assign(circuit.properties, circuitData.appearance)
  }

  // The appearance block to serialize — omitted entirely unless it carries real intent (a color, or
  // an explicit manual size), so default circuits keep a clean file and diff.
  function extractAppearance(properties = {}) {
    const a = {}
    for (const k of ['color', 'sizeMode', 'width', 'height']) {
      if (properties[k] !== undefined && properties[k] !== null) a[k] = properties[k]
    }
    return a.color || a.sizeMode === 'manual' ? a : undefined
  }

  // Assemble the circuitMetadata buildCircuitData needs: display fields plus the format generation
  // (which version to stamp + whether to reorder ports) and the appearance block.
  function metadataFor(circuit) {
    const p = circuit?.properties || {}
    return {
      name: circuit?.name,
      label: circuit?.label,
      interface: p.interface,
      formatVersion: circuit?.formatVersion,
      appearance: extractAppearance(p)
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
              id: nestedId,
              // An embedded subdef carries its own generation; default to the enclosing file's so
              // its ports resolve with the same ordering it was saved under.
              formatVersion: data.circuit.formatVersion || circuitData.version,
              hasUnsavedChanges: false
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
    if (circuitData.version) {
      targetCircuit.formatVersion = circuitData.version
    }
    if (circuitData.interface) {
      targetCircuit.properties = targetCircuit.properties || {}
      targetCircuit.properties.interface = circuitData.interface
    }
    applyAppearance(targetCircuit, circuitData)

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

    // The components we just re-loaded from disk carry their file's STALE, ephemeral circuitIds
    // (coined in some prior session). Re-derive them from the stable filename refs — otherwise a
    // stale id silently resolves to whatever circuit happens to hold it this load (the bug where
    // a counter's register slot showed a 5-bit EQ).
    resolveFilenameReferences()

    if (canvasRef.setLoadingState) {
      canvasRef.setLoadingState(false)
    }

    // Reset dirty flag — loading from disk is not a user change
    circuitManager.markCircuitAsSaved(circuitId)
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

    // Use the file this circuit was loaded from, not its name — they can differ (e.g. a file
    // whose internal name was edited), and deriving from the name would read the wrong file.
    const filename = circuit.sourceFilename || `${circuit.name}.ggc`
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
   * Load a set of already-read .ggc files (each { filename, content }) as circuits + tabs.
   * Clears the workspace, creates one circuit per file keyed by sourceFilename, resolves
   * subcircuit filename references among the loaded set, opens a tab per circuit, and focuses
   * `focusFilename` (or the first file). Used by the web .ggc drop.
   */
  async function loadCircuitsFromFiles(canvasRef, files, focusFilename = null) {
    canvasRef?.clearCircuit?.()
    circuitManager.allCircuits.value.clear()
    circuitManager.availableComponents.value.clear()
    circuitManager.openTabs.value = []

    const usedCircuitIds = new Set()
    for (const { filename, content } of files) {
      try {
        if (!content) continue
        const circuitData = parseAndValidateJSON(content)
        const circuit = circuitManager.createCircuit(circuitData.name, {
          id: deriveCircuitId(filename, usedCircuitIds),
          sourceFilename: filename,
          hasUnsavedChanges: false,
          formatVersion: circuitData.version,
          openTab: false
        })
        circuit.components = circuitData.components || []
        circuit.wires = circuitData.wires || []
        circuit.wireJunctions = circuitData.wireJunctions || []
        if (circuitData.interface) {
          circuit.properties = circuit.properties || {}
          circuit.properties.interface = circuitData.interface
        }
        applyAppearance(circuit, circuitData)
        circuitManager.saveCircuitAsComponent(circuit.id)
      } catch (err) {
        // An old-format file fails the whole open, loudly.
        if (err?.code === 'UNSUPPORTED_VERSION') {
          err.message = `${filename}: ${err.message}`
          throw err
        }
        console.warn(`Failed to load ${filename}:`, err)
      }
    }

    resolveFilenameReferences()

    for (const { filename } of files) {
      const circuit = circuitManager.getCircuitByFilename(filename)
      if (circuit) circuitManager.openTab(circuit.id)
    }
    const focus =
      (focusFilename && circuitManager.getCircuitByFilename(focusFilename)) ||
      (files[0] && circuitManager.getCircuitByFilename(files[0].filename))
    if (focus) circuitManager.openTab(focus.id)

    // Loading a project replaced every circuit (allCircuits was cleared above), so any undo
    // snapshots now reference deleted tabs — including the empty default circuit captured by the
    // clearCircuit() at the top. Drop them so a later undo can't restore a dead snapshot.
    canvasRef?.resetUndoHistory?.()
  }

  /**
   * Web .ggc drop: open the dropped file(s) as tabs. The browser can't see the directory, so
   * exactly the dropped files load (multi-drop a project's files together to resolve
   * subcircuits). There's no project directory in the browser, so a later Save uses the
   * no-project path.
   */
  async function openDroppedGgcFiles(canvasRef, ggcFiles) {
    const files = []
    for (const file of ggcFiles) {
      try {
        files.push({ filename: file.name, content: await file.text() })
      } catch (err) {
        console.warn(`Failed to read ${file.name}:`, err)
      }
    }
    if (files.length === 0) return

    const load = async () => {
      try {
        await loadCircuitsFromFiles(canvasRef, files, files[0].filename)
      } catch (err) {
        canvasRef?.showErrorNotification?.(err?.message || 'Failed to open circuits')
      }
    }
    const hasExistingWork = canvasRef?.components?.length > 0 || canvasRef?.wires?.length > 0
    if (hasExistingWork) {
      showConfirmation({
        title: 'Open Circuits?',
        message: 'This will replace your current work. Are you sure?',
        type: 'warning',
        onAccept: load
      })
    } else {
      await load()
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
  function handleInspectorAction(event, canvasRef = null) {
    const { action, circuit } = event

    switch (action) {
      case 'saveAsComponent':
        if (circuit) {
          const success = circuitManager.saveCircuitAsComponent(circuit.id)
          if (success) {
            canvasRef?.showInfoNotification?.(
              t('fileOperations.savedAsComponent', { name: circuit.name })
            )
          }
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
    isRunningTests,
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
    runTests,
    runCircuitSimulationWithHierarchy,
    stopSimulation,
    stepClock,
    saveCircuit,
    saveCircuitAs,
    openProject,
    loadSubcircuitData,
    openSubcircuitTab,
    openDroppedGgcFiles,
    handleInspectorAction,

    // Utility functions
    showConfirmation,
    hasUnsavedWork
  }
}
