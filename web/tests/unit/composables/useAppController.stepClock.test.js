import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Minimal i18n so useAppController can construct.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: key => key })
}))

vi.mock('@/composables/useFileService', () => ({
  useFileService: () => ({
    buildCircuitData: vi.fn(),
    saveCircuit: vi.fn(),
    openProject: vi.fn(),
    readCircuitFile: vi.fn(),
    parseAndValidateJSON: vi.fn()
  })
}))

// The engine's tick() driver, spied so we can assert exactly when it's poked.
const mockStepClockEngine = vi.fn()

vi.mock('@/composables/usePythonEngine', () => ({
  usePythonEngine: () => ({
    initialize: vi.fn(),
    runPython: vi.fn(),
    isLoading: ref(false),
    isReady: ref(true),
    error: ref(null),
    pyodide: ref(null),
    executePythonProgram: vi.fn(),
    generateProgramFromModel: vi.fn(),
    stopSimulation: vi.fn(),
    stepClock: mockStepClockEngine
  })
}))

describe('useAppController - stepClock gating', () => {
  let appController

  beforeEach(async () => {
    mockStepClockEngine.mockClear()
    const circuitManager = {
      allCircuits: ref(new Map()),
      availableComponents: ref(new Map()),
      activeTabId: ref('circuit_1'),
      activeCircuit: ref(null),
      currentProjectDir: ref(null),
      openTabs: ref([]),
      getCircuit: vi.fn(),
      projectCircuitFiles: ref([])
    }
    const { useAppController } = await import('@/composables/useAppController')
    appController = useAppController(circuitManager)
  })

  it('does not poke the engine when no simulation is running', () => {
    expect(appController.isRunning.value).toBe(false)
    appController.stepClock()
    expect(mockStepClockEngine).not.toHaveBeenCalled()
  })

  it('advances the clock once a simulation is running', () => {
    appController.isRunning.value = true
    appController.stepClock()
    expect(mockStepClockEngine).toHaveBeenCalledTimes(1)
  })
})
