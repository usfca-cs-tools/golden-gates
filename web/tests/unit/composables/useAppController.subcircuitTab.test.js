import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: key => key })
}))

const mockReadCircuitFile = vi.fn()
const mockParseAndValidateJSON = vi.fn()
const mockBuildCircuitData = vi.fn()

vi.mock('@/composables/useFileService', () => ({
  useFileService: () => ({
    buildCircuitData: mockBuildCircuitData,
    saveCircuit: vi.fn(),
    openProject: vi.fn(),
    readCircuitFile: mockReadCircuitFile,
    parseAndValidateJSON: mockParseAndValidateJSON
  })
}))

vi.mock('@/composables/usePythonEngine', () => ({
  usePythonEngine: () => ({
    initialize: vi.fn(),
    runPython: vi.fn(),
    isLoading: ref(false),
    isReady: ref(true),
    error: ref(null),
    pyodide: ref(null),
    executeHierarchicalCircuit: vi.fn(),
    stopSimulation: vi.fn()
  })
}))

describe('useAppController - subcircuit tab behavior', () => {
  let mockCircuitManager
  let mockCanvasRef
  let appController
  let navigateToCircuit
  let markCircuitAsSaved

  beforeEach(async () => {
    navigateToCircuit = vi.fn()
    markCircuitAsSaved = vi.fn()

    const subCircuit = {
      id: 'circuit_2',
      name: '4-bit Adder',
      label: '4-bit Adder',
      components: [{ id: 'gate1', type: 'and', x: 1, y: 1 }],
      wires: [],
      wireJunctions: [],
      properties: { interface: { inputs: [], outputs: [] } }
    }

    mockCircuitManager = {
      getCircuit: vi.fn(id => (id === 'circuit_2' ? subCircuit : null)),
      navigateToCircuit,
      markCircuitAsSaved,
      markCircuitAsModified: vi.fn(),
      currentProjectDir: ref('/projects/my-circuit'),
      projectCircuitFiles: ref(['4-bit Adder.ggc', 'TopLevel.ggc']),
      allCircuits: ref(new Map([['circuit_2', subCircuit]])),
      availableComponents: ref(new Map()),
      exportState: vi.fn(() => ({ nextCircuitId: 3 })),
      importState: vi.fn(),
      activeCircuit: ref(subCircuit),
      activeTabId: ref('circuit_1')
    }

    mockCanvasRef = {
      setLoadingState: vi.fn(),
      clearCircuit: vi.fn(),
      loadComponent: vi.fn(),
      addWire: vi.fn(),
      addWireJunction: vi.fn()
    }

    window.electronAPI = { writeCircuitFile: vi.fn() }

    mockReadCircuitFile.mockReset()
    mockParseAndValidateJSON.mockReset()

    const { useAppController } = await import('@/composables/useAppController')
    appController = useAppController(mockCircuitManager)
  })

  afterEach(() => {
    delete window.electronAPI
    vi.clearAllMocks()
  })

  it('reads subcircuit from disk when .ggc file exists in project', async () => {
    const fileContent = '{"name":"4-bit Adder","components":[],"wires":[]}'
    const parsedData = {
      name: '4-bit Adder',
      components: [{ id: 'from-disk', type: 'xor', x: 2, y: 2 }],
      wires: [{ id: 'w1' }],
      wireJunctions: []
    }

    mockReadCircuitFile.mockResolvedValue(fileContent)
    mockParseAndValidateJSON.mockReturnValue(parsedData)

    await appController.openSubcircuitTab(mockCanvasRef, 'circuit_2')

    expect(navigateToCircuit).toHaveBeenCalledWith('circuit_2')
    expect(mockReadCircuitFile).toHaveBeenCalledWith('/projects/my-circuit', '4-bit Adder.ggc')
    expect(mockParseAndValidateJSON).toHaveBeenCalledWith(fileContent)
    expect(mockCanvasRef.clearCircuit).toHaveBeenCalled()
    expect(mockCanvasRef.loadComponent).toHaveBeenCalledWith(parsedData.components[0])
    expect(mockCanvasRef.addWire).toHaveBeenCalledWith(parsedData.wires[0])
    expect(markCircuitAsSaved).toHaveBeenCalledWith('circuit_2')
  })

  it('opens in-memory tab without reading disk when no .ggc file exists', async () => {
    mockCircuitManager.projectCircuitFiles.value = ['TopLevel.ggc']

    await appController.openSubcircuitTab(mockCanvasRef, 'circuit_2')

    expect(navigateToCircuit).toHaveBeenCalledWith('circuit_2')
    expect(mockReadCircuitFile).not.toHaveBeenCalled()
    expect(mockCanvasRef.clearCircuit).not.toHaveBeenCalled()
  })

  it('falls back to in-memory navigation when no project is open', async () => {
    mockCircuitManager.currentProjectDir.value = null

    await appController.openSubcircuitTab(mockCanvasRef, 'circuit_2')

    expect(navigateToCircuit).toHaveBeenCalledWith('circuit_2')
    expect(mockReadCircuitFile).not.toHaveBeenCalled()
  })

  it('adds new filename to projectCircuitFiles on first save', async () => {
    mockCircuitManager.currentProjectDir.value = '/projects/my-circuit'
    mockCircuitManager.projectCircuitFiles.value = ['TopLevel.ggc']
    mockCircuitManager.activeCircuit.value = {
      id: 'circuit_2',
      name: 'NewComponent',
      label: 'New Component',
      properties: {}
    }
    mockCircuitManager.exportState.mockReturnValue({ nextCircuitId: 3 })
    mockBuildCircuitData.mockReturnValue({ version: '1.3', components: [], wires: [] })

    mockCanvasRef.components = []
    mockCanvasRef.wires = []
    mockCanvasRef.wireJunctions = []

    await appController.saveCircuit(mockCanvasRef)

    expect(window.electronAPI.writeCircuitFile).toHaveBeenCalledWith(
      '/projects/my-circuit',
      'NewComponent.ggc',
      expect.stringContaining('"version"')
    )
    expect(mockCircuitManager.projectCircuitFiles.value).toContain('NewComponent.ggc')
  })
})
