import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../../src/App.vue'
import CircuitTabsBar from '../../src/components/CircuitTabsBar.vue'
import ConfirmationDialog from '../../src/components/ConfirmationDialog.vue'

// Mock the vue-i18n composable
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: key => key
  })
}))

/**
 * Data Loss Prevention Test Suite
 *
 * This test suite focuses on the critical data loss prevention functionality:
 * 1. Confirmation dialogs when closing tabs with unsaved work
 * 2. Proper button configurations (safe defaults)
 * 3. Warning messages for data loss scenarios
 */

// Mock the composables for App tests
const mockCircuitManager = {
  tabs: [{ id: 'circuit_1', name: 'Test Circuit' }],
  activeTabId: 'circuit_1', // Destructured value (not reactive wrapper)
  activeCircuit: { id: 'circuit_1', name: 'Test Circuit', components: [], wires: [] },
  allCircuits: new Map(), // Destructured value (not reactive wrapper)
  openTabs: [{ id: 'circuit_1', name: 'Test Circuit' }], // Destructured value
  availableComponentsArray: [],
  availableComponents: { value: new Map() }, // Reactive property for autosave watcher
  createCircuit: vi.fn(),
  switchToTab: vi.fn(),
  closeTab: vi.fn(),
  getCircuit: vi.fn()
}

const mockCircuitOperations = {
  createNewCircuit: vi.fn(),
  runSimulation: vi.fn(),
  stopSimulation: vi.fn(),
  saveCircuit: vi.fn(),
  openProject: vi.fn(),
  loadCircuitData: vi.fn(),
  handleDroppedFile: vi.fn(),
  handleInspectorAction: vi.fn(),
  showConfirmation: vi.fn(),
  hasUnsavedWork: vi.fn(),
  handleBeforeUnload: vi.fn(),
  isRunning: false,
  isPyodideLoading: false,
  isPyodideReady: true,
  pyodideError: null,
  pyodide: {},
  showConfirmDialog: false,
  confirmDialog: {}
}

const mockCommandPalette = {
  isVisible: false
}

vi.mock('../../src/composables/useCircuitModel', () => ({
  useCircuitModel: () => mockCircuitManager
}))

vi.mock('../../src/composables/useAppController', () => ({
  useAppController: () => mockCircuitOperations
}))

vi.mock('../../src/composables/useCommandPalette', () => ({
  useCommandPalette: () => mockCommandPalette
}))

vi.mock('../../src/composables/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn()
}))

describe('Data Loss Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCircuitManager.getCircuit = vi.fn()
  })

  describe('Tab Closing - Critical Data Loss Prevention', () => {
    const createTabsWrapper = () => {
      return mount(CircuitTabsBar, {
        props: {
          circuitTabs: [{ id: 'circuit_1', name: 'Test Circuit' }],
          activeTabId: 'circuit_1',
          circuitManager: mockCircuitManager
        },
        global: {
          mocks: { $t: key => key },
          stubs: {
            Button: true
          }
        }
      })
    }

    it('CRITICAL: Should show confirmation when closing tab with unsaved components', async () => {
      const wrapper = createTabsWrapper()

      // Circuit with unsaved components
      mockCircuitManager.getCircuit.mockReturnValue({
        id: 'circuit_1',
        components: [{ id: 'comp1', type: 'and' }],
        wires: []
      })

      await wrapper.vm.handleCloseTab('circuit_1')

      // CRITICAL: Must show confirmation to prevent data loss
      expect(wrapper.emitted('showConfirmation')).toBeTruthy()
      expect(wrapper.emitted('closeTab')).toBeFalsy()

      const confirmationEvent = wrapper.emitted('showConfirmation')[0][0]
      expect(confirmationEvent.type).toBe('warning')
      expect(confirmationEvent.title).toBe('dialogs.unsavedChanges')
      expect(confirmationEvent.message).toBe('dialogs.unsavedChangesMessage')
    })

    it('CRITICAL: Should show confirmation when closing tab with unsaved wires', async () => {
      const wrapper = createTabsWrapper()

      // Circuit with unsaved wires
      mockCircuitManager.getCircuit.mockReturnValue({
        id: 'circuit_1',
        components: [],
        wires: [{ id: 'wire1', from: 'comp1', to: 'comp2' }]
      })

      await wrapper.vm.handleCloseTab('circuit_1')

      // CRITICAL: Must show confirmation to prevent data loss
      expect(wrapper.emitted('showConfirmation')).toBeTruthy()
      expect(wrapper.emitted('closeTab')).toBeFalsy()
    })

    it('SAFE: Should close immediately when no unsaved changes', async () => {
      const wrapper = createTabsWrapper()

      // Empty circuit - no data to lose
      mockCircuitManager.getCircuit.mockReturnValue({
        id: 'circuit_1',
        components: [],
        wires: []
      })

      await wrapper.vm.handleCloseTab('circuit_1')

      // Safe to close without confirmation
      expect(wrapper.emitted('showConfirmation')).toBeFalsy()
      expect(wrapper.emitted('closeTab')).toBeTruthy()
      expect(wrapper.emitted('closeTab')[0]).toEqual(['circuit_1'])
    })

    it('CRITICAL: User can save data by cancelling close operation', async () => {
      const wrapper = createTabsWrapper()

      mockCircuitManager.getCircuit.mockReturnValue({
        id: 'circuit_1',
        components: [{ id: 'comp1', type: 'and' }],
        wires: []
      })

      await wrapper.vm.handleCloseTab('circuit_1')

      // Get the onReject callback and call it (user cancels)
      const confirmationEvent = wrapper.emitted('showConfirmation')[0][0]
      confirmationEvent.onReject()

      // Tab should NOT be closed (data is safe)
      expect(wrapper.emitted('closeTab')).toBeFalsy()
    })

    it('CRITICAL: User can explicitly choose to lose data', async () => {
      const wrapper = createTabsWrapper()

      mockCircuitManager.getCircuit.mockReturnValue({
        id: 'circuit_1',
        components: [{ id: 'comp1', type: 'and' }],
        wires: []
      })

      await wrapper.vm.handleCloseTab('circuit_1')

      // Get the onAccept callback and call it (user confirms data loss)
      const confirmationEvent = wrapper.emitted('showConfirmation')[0][0]
      confirmationEvent.onAccept()

      // Tab should be closed (user explicitly chose to lose data)
      expect(wrapper.emitted('closeTab')).toBeTruthy()
      expect(wrapper.emitted('closeTab')[0]).toEqual(['circuit_1'])
    })
  })

  describe('Confirmation Dialog - Safe Defaults', () => {
    const createDialogWrapper = (props = {}) => {
      return mount(ConfirmationDialog, {
        props: {
          visible: false,
          message: 'Test message',
          ...props
        }
      })
    }

    it('CRITICAL: Default cancel button text is "Cancel" not "No" (safer)', () => {
      const wrapper = createDialogWrapper({
        visible: true,
        showCancel: true
      })

      const cancelButton = wrapper.find('.modal-button-cancel')
      expect(cancelButton.text()).toBe('Cancel')
    })

    it('CRITICAL: Warning dialogs show both Yes and Cancel buttons', () => {
      const wrapper = createDialogWrapper({
        visible: true,
        type: 'warning'
      })

      const acceptButton = wrapper.find('.modal-button-confirm')
      const cancelButton = wrapper.find('.modal-button-cancel')

      expect(acceptButton.exists()).toBe(true)
      expect(cancelButton.exists()).toBe(true)
    })

    it('SAFE: Info dialogs can show only OK button (no data loss)', () => {
      const wrapper = createDialogWrapper({
        visible: true,
        type: 'info',
        showCancel: false
      })

      const acceptButton = wrapper.find('.modal-button-confirm')
      const cancelButton = wrapper.find('.modal-button-cancel')

      expect(acceptButton.exists()).toBe(true)
      expect(cancelButton.exists()).toBe(false)
    })

    it('CRITICAL: Cannot accidentally close dialog by clicking overlay', async () => {
      const wrapper = createDialogWrapper({ visible: true })

      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click')

      // Should not emit any close events
      expect(wrapper.emitted('accept')).toBeFalsy()
      expect(wrapper.emitted('reject')).toBeFalsy()
      expect(wrapper.emitted('update:visible')).toBeFalsy()
    })

    it('CRITICAL: Dangerous button styling for data loss scenarios', () => {
      const wrapper = createDialogWrapper({
        visible: true,
        type: 'warning',
        acceptLabel: 'Close Without Saving'
      })

      const acceptButton = wrapper.find('.modal-button-confirm')
      expect(acceptButton.classes()).toContain('modal-button-warning')
      expect(acceptButton.text()).toBe('Close Without Saving')
    })
  })

  describe('Error Dialogs - No Data Loss Risk', () => {
    it('SAFE: Error dialogs show only OK button (no choices = no data loss)', () => {
      const wrapper = mount(ConfirmationDialog, {
        props: {
          visible: true,
          title: 'Error',
          message: 'Failed to save',
          type: 'danger',
          showCancel: false
        }
      })

      const acceptButton = wrapper.find('.modal-button-confirm')
      const cancelButton = wrapper.find('.modal-button-cancel')

      expect(acceptButton.exists()).toBe(true)
      expect(cancelButton.exists()).toBe(false)
      expect(acceptButton.classes()).toContain('modal-button-danger')
    })

    it('SAFE: Success dialogs show only OK button', () => {
      const wrapper = mount(ConfirmationDialog, {
        props: {
          visible: true,
          title: 'Success',
          message: 'Component saved',
          type: 'info',
          showCancel: false
        }
      })

      const acceptButton = wrapper.find('.modal-button-confirm')
      const cancelButton = wrapper.find('.modal-button-cancel')

      expect(acceptButton.exists()).toBe(true)
      expect(cancelButton.exists()).toBe(false)
      expect(acceptButton.classes()).toContain('modal-button-info')
    })
  })
})
