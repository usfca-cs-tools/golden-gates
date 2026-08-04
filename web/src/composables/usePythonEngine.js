import { ref, shallowRef } from 'vue'
import { loadPyodide } from 'pyodide'

/**
 * Python Engine - Unified Pyodide integration for circuit simulation
 * Combines Pyodide initialization, MEMFS operations, and Python execution
 */

// Singleton Pyodide instance and state
const pyodideInstance = shallowRef(null)
const isLoading = ref(false)
const isReady = ref(false)
const error = ref(null)

export function usePythonEngine() {
  /**
   * Initialize Pyodide with GGL module setup
   */
  async function initialize() {
    if (pyodideInstance.value) {
      return pyodideInstance.value
    }

    isLoading.value = true
    error.value = null

    try {
      pyodideInstance.value = await loadPyodide({
        indexURL: new URL('pyodide/', document.baseURI).href
      })

      // Dev-only: expose the runtime so the console can drive Python directly.
      if (import.meta.env.DEV) {
        window.pyodide = pyodideInstance.value
      }

      // GGL engine files are served at /ggl/ by vite-plugin-static-copy,
      // sourced from the `ggl` submodule (web/ggl-engine/src/ggl) — see vite.config.js.
      const gglBaseUrl = new URL('ggl/', document.baseURI).href
      
      // Set up ggl module loading for Pyodide
      await pyodideInstance.value.runPythonAsync(`
import sys
import os
from pyodide.http import pyfetch

# Create a directory for the ggl module
os.makedirs('/home/pyodide/ggl', exist_ok=True)

# Function to recursively fetch Python files
async def fetch_python_files(base_url, target_dir):
    """
    Fetch __init__.py first, which should contain imports that tell us
    what other files we need to fetch.
    """
    # Start with __init__.py
    try:
        response = await pyfetch(f"{base_url}__init__.py")
        if response.status == 200:
            content = await response.text()
            with open(f"{target_dir}/__init__.py", 'w') as f:
                f.write(content)
            
            # Parse imports to find other required files
            import ast
            tree = ast.parse(content)
            
            required_files = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module is None:
                    # from .module import ...
                    for alias in node.names:
                        if alias.name != '*':
                            required_files.add(f"{alias.name}.py")
                elif isinstance(node, ast.ImportFrom) and node.level == 1:
                    # from .module import ...
                    module_name = node.module.split('.')[0]
                    required_files.add(f"{module_name}.py")
            
            # Also add any additional known files that might not be imported
            additional_files = ['ggl_logging.py']
            required_files.update(additional_files)
            
            # Fetch each required file
            for filename in required_files:
                try:
                    response = await pyfetch(f"{base_url}{filename}")
                    if response.status == 200:
                        content = await response.text()
                        with open(f"{target_dir}/{filename}", 'w') as f:
                            f.write(content)
                        print(f"Fetched {filename}")
                except Exception as e:
                    print(f"Warning: Could not fetch {filename}: {e}")
                    
            print(f"GGL module loaded with {len(required_files) + 1} files")
            
    except Exception as e:
        print(f"Error loading ggl module: {e}")

# Fetch the ggl module files
await fetch_python_files('${gglBaseUrl}', '/home/pyodide/ggl')

# Add to Python path
sys.path.insert(0, '/home/pyodide')

# Test import
try:
    import ggl
    if not hasattr(ggl, 'circuit'):
        raise ImportError("ggl loaded as empty namespace package — GGL files may not have been fetched")
    print("GGL module imported successfully")
except ImportError as e:
    print(f"Warning: Could not import ggl: {e}")
      `)

      isReady.value = true

      return pyodideInstance.value
    } catch (err) {
      error.value = err
      console.error('Failed to load Pyodide:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Execute Python code asynchronously
   */
  async function runPython(code) {
    if (!pyodideInstance.value) {
      throw new Error('Pyodide not initialized. Call initialize() first.')
    }

    try {
      return await pyodideInstance.value.runPythonAsync(code)
    } catch (err) {
      console.error('Python execution error:', err)
      throw err
    }
  }

  /**
   * Execute Python code synchronously
   */
  function runPythonSync(code) {
    if (!pyodideInstance.value) {
      throw new Error('Pyodide not initialized. Call initialize() first.')
    }

    try {
      return pyodideInstance.value.runPython(code)
    } catch (err) {
      console.error('Python execution error:', err)
      throw err
    }
  }

  /**
   * Load a Python package
   */
  async function loadPackage(packageName) {
    if (!pyodideInstance.value) {
      throw new Error('Pyodide not initialized. Call initialize() first.')
    }

    try {
      await pyodideInstance.value.loadPackage(packageName)
    } catch (err) {
      console.error(`Failed to load package ${packageName}:`, err)
      throw err
    }
  }

  /**
   * Execute a Python program in Pyodide with proper error handling
   * Uses compile() with PyCF_ALLOW_TOP_LEVEL_AWAIT to support await in generated code
   */
  async function executePythonProgram(gglProgram) {
    if (!pyodideInstance.value) {
      throw new Error('Pyodide not initialized. Call initialize() first.')
    }

    const pythonExecutionCode = `
# Register the Vue update callback with the ggl engine.
import js
import ggl.callbacks
ggl.callbacks.set_callback(js.window.__vueUpdateCallback)

try:
    # Compile and execute with async support
    import ast
    code = compile(${JSON.stringify(gglProgram)}, '<string>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    coro = eval(code)
    if coro is not None:
        await coro
    result = "Simulation completed successfully"
except Exception as e:
    # Check if this is a CircuitError with structured data
    if hasattr(e, 'to_dict'):
        # It's a CircuitError - convert to dict and pass to JavaScript
        import json
        error_data = e.to_dict()
        # Serialize to JSON to avoid proxy object issues
        error_json = json.dumps(error_data)
        js.window.__vueStructuredErrorCallback(error_json)
        raise e  # Re-raise so JavaScript can handle it
    else:
        # Regular exception - let it propagate normally
        raise e

result
`

    return await pyodideInstance.value.runPythonAsync(pythonExecutionCode)
  }

  /**
   * Pass 1 of the ggl.view flow: run ggl.view.generate(model, mode) in Pyodide and
   * return the GGL program string. Runs nothing — the caller logs the program and hands
   * it to executePythonProgram (pass 2). `model` is a .ggc-shaped dict (components with
   * ports + inlined schematicComponents); `mode` is a ggl.view mode ('run_async'/'test').
   * The dict is serialized to JSON and embedded as a Python string literal for json.loads.
   */
  async function generateProgramFromModel(model, mode = 'run_async') {
    if (!pyodideInstance.value) {
      throw new Error('Pyodide not initialized. Call initialize() first.')
    }
    const code = `
import json
import js
import ggl.view
try:
    __ggl_program = ggl.view.generate(json.loads(${JSON.stringify(JSON.stringify(model))}), ${JSON.stringify(mode)})
except Exception as __e:
    # generate() can raise a structured CircuitError (e.g. an invalid tunnel net) before
    # anything runs. Hand its detail to the same channel run-time errors use so the caller
    # can highlight the offending component, then re-raise for the JS catch.
    if hasattr(__e, 'to_dict'):
        js.window.__vueStructuredErrorCallback(json.dumps(__e.to_dict()))
    raise
__ggl_program
`
    return await pyodideInstance.value.runPythonAsync(code)
  }

  /**
   * Stop the running circuit simulation by calling circuit0.stop() in Python
   */
  async function stopSimulation() {
    if (!pyodideInstance.value) {
      console.warn('Pyodide not initialized, nothing to stop')
      return
    }

    try {
      await pyodideInstance.value.runPythonAsync('circuit0.stop()')
    } catch (err) {
      // circuit0 may not exist if simulation hasn't started or already finished
      console.warn('Could not stop simulation:', err.message)
    }
  }

  /**
   * Update an input node's value at runtime
   */
  async function updateInput(componentId, value) {
    if (!pyodideInstance.value) {
      console.warn('Pyodide not initialized, cannot update input')
      return
    }

    try {
      await pyodideInstance.value.runPythonAsync(
        `circuit0.update_input("${componentId}", ${value})`
      )
    } catch (err) {
      console.warn('Could not update input:', err.message)
    }
  }

  return {
    // State
    pyodide: pyodideInstance,
    isLoading,
    isReady,
    error,

    // Core Pyodide operations
    initialize,
    runPython,
    runPythonSync,
    loadPackage,

    // Python execution
    executePythonProgram,
    generateProgramFromModel,

    // Simulation control
    stopSimulation,
    updateInput
  }
}
