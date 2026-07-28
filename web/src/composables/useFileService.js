// Golden Gates circuits are JSON saved with a `.ggc` extension — the file type
// registered with the OS for double-click open. Older circuits were saved as
// `.json`, so opening still accepts both.
const CIRCUIT_EXT = 'ggc'


// Getting the top level filename from the directory path 
function deriveTopLevelFilename(dirPath) {
  const dirName = dirPath.split('/').pop()       
  const baseName = dirName.split('-')[0]        
  return `${baseName}.ggc`
}


function buildCircuitData(
  components,
  wires,
  wireJunctions,
  circuitMetadata = {},
  schematicComponents = {},
  nextCircuitId = 1, 
  { standalone = false } = {}  
) {
  const sanitizedComponents = (components || []).map(component => {
    const { js_id, ...componentWithoutJsId } = component || {}

    if (component.type === 'input' || component.type === 'output') {
      const { value, lastUpdate, ...propsWithoutTransient } = component.props || {}
      return {
        ...componentWithoutJsId,
        props: propsWithoutTransient
      }
    }

    return componentWithoutJsId
  })

  const sanitizedSchematicComponents = {}
  for (const [circuitId, schematicData] of Object.entries(schematicComponents || {})) {
    let sanitizedCircuit = schematicData.circuit
    if (sanitizedCircuit && sanitizedCircuit.components) {
      const sanitizedSubComponents = sanitizedCircuit.components.map(component => {
        const { js_id, ...componentWithoutJsId } = component || {}

        if (component.type === 'input' || component.type === 'output') {
          const { value, lastUpdate, ...propsWithoutTransient } = component.props || {}
          return {
            ...componentWithoutJsId,
            props: propsWithoutTransient
          }
        }

        return componentWithoutJsId
      })

      sanitizedCircuit = {
        ...sanitizedCircuit,
        components: sanitizedSubComponents
      }
    }

    sanitizedSchematicComponents[circuitId] = {
      ...schematicData,
      circuit: sanitizedCircuit
    }
  }

  return {
    version: '1.3',
    timestamp: new Date().toISOString(),
    name: circuitMetadata.name || 'Untitled Circuit',
    label: circuitMetadata.label || circuitMetadata.name || 'Untitled Circuit',
    interface: circuitMetadata.interface,
    nextCircuitId,
    components: sanitizedComponents,
    wires: wires || [],
    wireJunctions: wireJunctions || [],
    schematicComponents: sanitizedSchematicComponents, 
    schematicComponents: standalone ? {} : sanitizedSchematicComponents
  }
}

export function useFileService() {
  const saveCircuit = async (
    components,
    wires,
    wireJunctions,
    circuitMetadata = {},
    schematicComponents = {},
    nextCircuitId = 1,
    projectContext = null
  ) => {
    try {
      const circuitData = buildCircuitData(
        components,
        wires,
        wireJunctions,
        circuitMetadata,
        schematicComponents,
        nextCircuitId
      )
      const jsonString = JSON.stringify(circuitData, null, 2)

      // Check if File System Access API is supported
      // if ('showSaveFilePicker' in window) { 
      
      // Check if running in Electron
      if (window.electronAPI) {
        const circuitName = circuitMetadata.name || 'circuit'
        const defaultName = `${circuitName}.${CIRCUIT_EXT}` // Removing timestamp from filename

        if (projectContext?.dirPath && projectContext?.filename) {
          await window.electronAPI.writeCircuitFile(
            projectContext.dirPath,
            projectContext.filename,
            jsonString
          )
        } else {
          await window.electronAPI.saveCircuitAs(jsonString, defaultName)
        }
      } else if ('showSaveFilePicker' in window) {
        try {
          // Use the File System Access API for better UX
          const circuitName = circuitMetadata.name || 'circuit'
          const handle = await window.showSaveFilePicker({
            suggestedName: `${circuitName}.${CIRCUIT_EXT}`,
            types: [
              {
                description: 'Golden Gates Circuit',
                accept: { 'application/json': [`.${CIRCUIT_EXT}`] }
              }
            ]
          })

          // Create a writable stream and write the file
          const writable = await handle.createWritable()
          await writable.write(jsonString)
          await writable.close()
        } catch (err) {
          // User cancelled the save dialog
          if (err.name === 'AbortError') {
            return
          }
          throw err
        }
      } else {
        // Fallback to traditional download for browsers that don't support File System Access API
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const circuitName = circuitMetadata.name || 'circuit'
        const link = document.createElement('a')
        link.href = url
        link.download = `${circuitName}.${CIRCUIT_EXT}`
        document.body.appendChild(link)
        link.click()

        // Clean up
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error saving circuit:', error)
      throw error
    }
  }

  const openProject = async (dirPath = null) => {
    if (!window.electronAPI) return null

    let resolvedDirPath = dirPath
    if (!resolvedDirPath) {
      resolvedDirPath = await window.electronAPI.pickProjectDirectory()
      if (!resolvedDirPath) return null
    }

    const { files } = await window.electronAPI.openProject(resolvedDirPath)
    const topLevelFilename = deriveTopLevelFilename(resolvedDirPath)

    // Read top-level circuit (create blank if it doesn't exist yet)
    let topLevelContent = null
    if (files.includes(topLevelFilename)) {
      topLevelContent = await window.electronAPI.readCircuitFile(resolvedDirPath, topLevelFilename)
    }

    return {
      dirPath: resolvedDirPath,
      topLevelFilename,
      topLevelContent,  // null if new/empty project
      allFiles: files
    }
  }

  const readCircuitFile = async (dirPath, filename) => {
    if (!window.electronAPI) return null
    return window.electronAPI.readCircuitFile(dirPath, filename)
  }

  const saveCircuitFile = async (dirPath, filename, content) => {
    if (!window.electronAPI) return false
    return window.electronAPI.writeCircuitFile(dirPath, filename, content)
  }

  const validateCircuitData = circuitData => {
    // Validate the circuit data structure
    if (!circuitData || typeof circuitData !== 'object') {
      throw new Error('Invalid circuit file: not an object')
    }

    if (!Array.isArray(circuitData.components)) {
      throw new Error('Invalid circuit file: missing components array')
    }

    if (!Array.isArray(circuitData.wires)) {
      throw new Error('Invalid circuit file: missing wires array')
    }

    // Validate component structure
    for (const component of circuitData.components) {
      if (
        !component.id ||
        !component.type ||
        typeof component.x !== 'number' ||
        typeof component.y !== 'number'
      ) {
        throw new Error('Invalid component structure')
      }
    }

    // Validate v1.1+ format fields
    if (circuitData.name && typeof circuitData.name !== 'string') {
      throw new Error('Invalid circuit file: name must be a string')
    }

    if (circuitData.label && typeof circuitData.label !== 'string') {
      throw new Error('Invalid circuit file: label must be a string')
    }

    if (circuitData.interface && typeof circuitData.interface !== 'object') {
      throw new Error('Invalid circuit file: interface must be an object')
    }

    if (circuitData.schematicComponents && typeof circuitData.schematicComponents !== 'object') {
      throw new Error('Invalid circuit file: schematicComponents must be an object')
    }

    return true
  }

  const migrateCircuitData = circuitData => {
    // Constants for migration
    const GRID_SIZE = 15

    // Check if this is an old format that needs migration
    // We can detect this by checking if wire coordinates are large numbers (pixels)
    // or if version is missing/old
    const needsMigration = !circuitData.version || circuitData.version < '1.2'

    if (!needsMigration) {
      // Even if no coordinate migration is needed, ensure nextCircuitId is present
      if (!circuitData.nextCircuitId) {
        // For files without nextCircuitId, calculate a safe starting value
        const maxCircuitId = Math.max(
          ...Object.keys(circuitData.schematicComponents || {}).map(id =>
            id.match(/^circuit_(\d+)$/) ? parseInt(id.split('_')[1]) : 0
          ),
          1
        )
        circuitData.nextCircuitId = maxCircuitId + 1
      }
      return circuitData
    }

    // Create a copy to avoid mutating original data
    const migratedData = JSON.parse(JSON.stringify(circuitData))

    // Migrate component coordinates (if they're in pixels)
    if (migratedData.components) {
      migratedData.components.forEach(component => {
        // If coordinates are large numbers, they're likely in pixels
        if (component.x > 20 || component.y > 20) {
          component.x = Math.round(component.x / GRID_SIZE)
          component.y = Math.round(component.y / GRID_SIZE)
        }
      })
    }

    // Migrate wire coordinates (if they're in pixels)
    if (migratedData.wires) {
      migratedData.wires.forEach(wire => {
        if (wire.points) {
          wire.points.forEach(point => {
            // If coordinates are large numbers, they're likely in pixels
            if (point.x > 20 || point.y > 20) {
              point.x = Math.round(point.x / GRID_SIZE)
              point.y = Math.round(point.y / GRID_SIZE)
            }
          })
        }

        // Migrate wire connection positions
        if (wire.startConnection && wire.startConnection.pos) {
          const pos = wire.startConnection.pos
          if (pos.x > 20 || pos.y > 20) {
            pos.x = Math.round(pos.x / GRID_SIZE)
            pos.y = Math.round(pos.y / GRID_SIZE)
          }
        }

        if (wire.endConnection && wire.endConnection.pos) {
          const pos = wire.endConnection.pos
          if (pos.x > 20 || pos.y > 20) {
            pos.x = Math.round(pos.x / GRID_SIZE)
            pos.y = Math.round(pos.y / GRID_SIZE)
          }
        }
      })
    }

    // Migrate wire junction positions
    if (migratedData.wireJunctions) {
      migratedData.wireJunctions.forEach(junction => {
        if (junction.pos) {
          const pos = junction.pos
          if (pos.x > 20 || pos.y > 20) {
            pos.x = Math.round(pos.x / GRID_SIZE)
            pos.y = Math.round(pos.y / GRID_SIZE)
          }
        }
      })
    }

    // Calculate nextCircuitId for migrated data
    if (!migratedData.nextCircuitId) {
      // For migrated files, calculate a safe starting value
      const maxCircuitId = Math.max(
        ...Object.keys(migratedData.schematicComponents || {}).map(id =>
          id.match(/^circuit_(\d+)$/) ? parseInt(id.split('_')[1]) : 0
        ),
        1
      )
      migratedData.nextCircuitId = maxCircuitId + 1
    }

    // Update version to indicate migration
    migratedData.version = '1.3'

    return migratedData
  }

  const parseAndValidateJSON = jsonString => {
    try {
      const circuitData = JSON.parse(jsonString)
      validateCircuitData(circuitData)

      // Migrate data format if needed
      const migratedData = migrateCircuitData(circuitData)

      return migratedData
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Invalid JSON format: ' + err.message)
      }
      throw err
    }
  }

  return {
    buildCircuitData,
    saveCircuit,
    openProject,
    readCircuitFile,
    saveCircuitFile,
    parseAndValidateJSON
  }
}
