<template>
  <BrowserCompatibilityGuard>
    <div id="app">
      <ConfirmationDialog
        v-model:visible="showConfirmDialog"
        :title="confirmDialog.title"
        :message="confirmDialog.message"
        :type="confirmDialog.type"
        :acceptLabel="confirmDialog.acceptLabel"
        :showCancel="confirmDialog.showCancel"
        @accept="confirmDialog.acceptCallback"
        @reject="confirmDialog.rejectCallback"
      />
      <CommandPalette
        v-model="commandPaletteVisible"
        :availableComponents="availableComponentsArray"
        @command="handleCommand"
      />
      <AppToolbar
        :circuitTabs="circuitTabs"
        :activeTabId="activeTabId"
        :circuitManager="circuitManager"
        @openCommandPalette="commandPaletteVisible = true"
        @switchToTab="switchToTab"
        @closeTab="handleCloseTab"
        @showConfirmation="showConfirmation"
        @toggleInspector="inspectorVisible = !inspectorVisible"
      />

      <div class="main-content">
        <div
          class="circuit-container"
          :class="{ 'drag-over': isDraggingOver }"
          :data-drop-message="$t('ui.dropFileHere')"
          @dragover.prevent="handleDragOver"
          @drop.prevent="handleDrop"
          @dragenter.prevent="handleDragEnter"
          @dragleave.prevent="handleDragLeave"
        >
          <CircuitCanvas
            ref="canvas"
            :circuitManager="circuitManager"
            :autosave="autosave"
            @selectionChanged="handleSelectionChanged"
            @editSubcircuit="handleEditSubcircuit"
          />
        </div>

        <div
          v-if="inspectorVisible"
          class="inspector-panel"
          :style="inspectorPanelStyle"
          @keydown.esc="returnFocusToCanvas"
        >
          <div class="inspector-header">
            <button
              class="inspector-expand"
              @click="inspectorExpanded = !inspectorExpanded"
              :title="inspectorExpanded ? 'Collapse Inspector' : 'Expand Inspector'"
            >
              <i :class="inspectorExpanded ? 'pi pi-chevron-right' : 'pi pi-chevron-left'"></i>
            </button>
            <button class="inspector-close" @click="inspectorVisible = false">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <ComponentInspector
            :component="selectedComponent"
            :circuit="selectedCircuit"
            @update:component="updateComponent"
            @update:circuit="updateCircuit"
            @action="e => handleInspectorAction(e, $refs.canvas)"
          />
        </div>

        <!-- Subtle simulation loading indicator -->
        <div v-if="isRunning || isPyodideLoading" class="simulation-loading">
          <i class="pi pi-spin pi-spinner"></i>
          <span>{{
            isPyodideLoading ? $t('simulation.initializing') : $t('simulation.running')
          }}</span>
        </div>
      </div>
    </div>
  </BrowserCompatibilityGuard>
</template>

<script>
import CircuitCanvas from './components/CircuitCanvas.vue'
import ComponentInspector from './components/ComponentInspector.vue'
import ComponentIcon from './components/ComponentIcon.vue'
import ConfirmationDialog from './components/ConfirmationDialog.vue'
import CommandPalette from './components/CommandPalette.vue'
import AppToolbar from './components/AppToolbar.vue'
import BrowserCompatibilityGuard from './components/BrowserCompatibilityGuard.vue'
import { usePythonEngine } from './composables/usePythonEngine'

const { updateInput } = usePythonEngine()
import { useFileService } from './composables/useFileService'
import { useCircuitModel } from './composables/useCircuitModel'
import { useAppController } from './composables/useAppController'
import { useAutosave } from './composables/useAutosave'
import { useCommandPalette } from './composables/useCommandPalette'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts'
import './styles/themes.css'

export default {
  name: 'App',
  components: {
    CircuitCanvas,
    ComponentIcon,
    ComponentInspector,
    ConfirmationDialog,
    CommandPalette,
    AppToolbar,
    BrowserCompatibilityGuard
  },
  setup() {
    // Initialize circuit manager (model layer)
    const circuitManager = useCircuitModel()

    // Initialize autosave system
    const autosave = useAutosave(circuitManager)

    // Initialize circuit operations (controller layer)
    const circuitOperations = useAppController(circuitManager)

    // Extract needed properties for template
    const {
      tabs: circuitTabs,
      activeTabId,
      activeCircuit,
      allCircuits,
      availableComponentsArray,
      createCircuit,
      switchToTab,
      closeTab
    } = circuitManager

    const {
      createNewCircuit,
      runSimulation,
      runTests,
      stopSimulation,
      saveCircuit,
      saveCircuitAs,
      openProject: openProjectInternal,
      openSubcircuitTab,
      openDroppedGgcFiles,
      handleInspectorAction,
      showConfirmation,
      isRunning,
      isPyodideLoading,
      isPyodideReady,
      pyodideError,
      pyodide,
      showConfirmDialog,
      confirmDialog
    } = circuitOperations

    // Initialize command palette
    const { isVisible: commandPaletteVisible } = useCommandPalette()

    // Set up keyboard shortcuts - we'll set command actions in mounted
    const { setCommandActions } = useKeyboardShortcuts(null, availableComponentsArray)

    return {
      // Circuit manager
      circuitManager,
      circuitTabs,
      activeTabId,
      activeCircuit,
      allCircuits,
      availableComponentsArray,
      createCircuit,
      switchToTab,
      closeTab,

      // Autosave system
      autosave,

      // Circuit operations
      createNewCircuit,
      runSimulation,
      runTests,
      stopSimulation,
      saveCircuit,
      saveCircuitAs,
      openProjectInternal,
      openSubcircuitTab,
      openDroppedGgcFiles,
      handleInspectorAction,
      showConfirmation,
      isRunning,
      isPyodideLoading,
      isPyodideReady,
      pyodideError,
      pyodide,
      showConfirmDialog,
      confirmDialog,
      commandPaletteVisible,
      setCommandActions
    }
  },
  data() {
    return {
      inspectorVisible: true,
      inspectorExpanded: false,
      selectedComponent: null,
      selectedCircuit: null,
      isDraggingOver: false,
      dragCounter: 0,
    }
  },
  computed: {
    inspectorPanelStyle() {
      const width = this.inspectorExpanded ? 440 : 220 // Exactly double the normal width
      return {
        width: width + 'px'
      }
    }
  },
  methods: {
    handleCommand({ action, params }) {
      // Handle command palette commands by calling the appropriate method directly
      switch (action) {
        case 'addComponent':
          this.addComponent(...params)
          break
        case 'addCircuitComponent':
          this.addCircuitComponent(...params)
          break
        case 'createNewCircuit':
          this.createNewCircuit()
          break
        case 'clearCircuit':
          this.clearCircuit()
          break
        case 'runSimulation':
          this.runSimulation(this.$refs.canvas)
          break
        case 'runTests':
          this.runTests(this.$refs.canvas)
          break
        case 'stopSimulation':
          this.stopSimulation()
          break
      }
    },

    addComponent(type) {
      if (this.$refs.canvas) {
        this.$refs.canvas.addComponentAtSmartPosition(type)
      }
    },

    addCircuitComponent(circuitId) {
      if (this.$refs.canvas) {
        const component = this.circuitManager.createSchematicComponent(circuitId)
        if (component) {
          this.$refs.canvas.addComponentAtSmartPosition('schematic-component', component.props)
        }
      }
    },

    handleCloseTab(circuitId) {
      // Close tab directly - confirmation logic now handled by CircuitTabsBar
      this.closeTab(circuitId)
    },

    handleEditSubcircuit(circuitId) {
      this.openSubcircuitTab(this.$refs.canvas, circuitId)
    },

    handleSelectionChanged(selection) {
      // Handle single component selection
      if (selection.components.size === 1) {
        const componentId = Array.from(selection.components)[0]
        this.selectedComponent =
          this.$refs.canvas?.components.find(c => c.id === componentId) || null
        this.selectedCircuit = null // Clear circuit selection when component is selected
      } else {
        this.selectedComponent = null
        // Show current circuit properties when no component is selected
        this.selectedCircuit = this.activeCircuit
      }
    },

    // Esc in the property inspector blurs the focused field and hands keyboard focus back
    // to the canvas (issue #132), so single-key shortcuts (R/T, etc.) work again instead of
    // typing into the input. Edits are applied live, so there's nothing to commit or revert.
    returnFocusToCanvas(event) {
      event.target?.blur?.()
      this.$refs.canvas?.focusCanvas?.()
    },

    updateComponent(updatedComponent) {
      if (this.$refs.canvas) {
        // Capture the pre-update value to detect an actual change below. (Wires are
        // independent geometry: a component's ports moving does not drag attached
        // wires, so nothing here reconciles endpoints — connectivity is re-derived
        // from wire/port coordinates at run time.)
        const oldComponent = this.$refs.canvas.components.find(c => c.id === updatedComponent.id)

        this.$refs.canvas.updateComponent(updatedComponent)

        // If simulation is running and this is an input with a changed value, update Python
        if (
          this.isRunning &&
          updatedComponent.type === 'input' &&
          oldComponent?.props?.value !== updatedComponent.props?.value
        ) {
          updateInput(updatedComponent.id, updatedComponent.props.value)
        }

        // Refresh the selected component reference to maintain sync
        if (this.selectedComponent && this.selectedComponent.id === updatedComponent.id) {
          this.selectedComponent = this.$refs.canvas.components.find(
            c => c.id === updatedComponent.id
          )
        }
      }
    },


    updateCircuit(updatedCircuit) {
      // Update circuit properties in the circuit manager
      const circuit = this.circuitManager.getCircuit(updatedCircuit.id)
      if (circuit) {
        // The Filename field IS the on-disk name. If it changed for a circuit already saved to
        // disk, remember the current file (so save can delete it) and point sourceFilename at
        // the new name — the next save writes <newName>.ggc and removes the old file. Only an
        // explicit edit triggers this; a file whose name already differs from the circuit isn't
        // touched until the user renames it. Cross-file refs self-heal: parents write each ref
        // from the target circuit's sourceFilename.
        if (updatedCircuit.name && updatedCircuit.name !== circuit.name && circuit.sourceFilename) {
          if (!circuit.renamedFromFilename) {
            circuit.renamedFromFilename = circuit.sourceFilename
          }
          circuit.sourceFilename = `${updatedCircuit.name}.ggc`
        }
        // Update reactive properties (the circuit "label" is retired — name only)
        circuit.name = updatedCircuit.name
        circuit.properties = {
          ...circuit.properties,
          ...updatedCircuit.properties
        }
        // Circuit metadata edits (name/label/interface) are a real change that gets written
        // to the .ggc — mark dirty so the save-on-quit prompt catches it.
        this.circuitManager.markCircuitAsModified(circuit.id)

        // Update selectedCircuit to reflect changes
        this.selectedCircuit = circuit
      }
    },

    async saveCircuitFile() {
      await this.saveCircuit(this.$refs.canvas)
    },

    async openProject({ dirPath, activeFile = null } = {}) {
      await this.openProjectInternal(this.$refs.canvas, dirPath, activeFile)
    },

    handleDragEnter(event) {
      this.dragCounter++
      if (event.dataTransfer.types.includes('Files')) {
        this.isDraggingOver = true
      }
    },

    handleDragLeave(event) {
      this.dragCounter--
      if (this.dragCounter <= 0) {
        this.isDraggingOver = false
        this.dragCounter = 0
      }
    },

    handleDragOver(event) {
      // Check if the drag contains files
      if (event.dataTransfer.types.includes('Files')) {
        event.dataTransfer.dropEffect = 'copy'
      }
    },

    async handleDrop(event) {
      this.isDraggingOver = false
      this.dragCounter = 0

      // Extract synchronously — dataTransfer is only valid during the event. Detect a dropped
      // folder and collect .ggc files. JSON drop is no longer supported.
      const items = Array.from(event.dataTransfer.items || [])
      let folderFile = null
      const ggcFiles = []
      for (const item of items) {
        if (item.kind !== 'file') continue
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null
        const file = item.getAsFile()
        if (entry && entry.isDirectory) {
          if (!folderFile) folderFile = file
        } else if (file && file.name.toLowerCase().endsWith('.ggc')) {
          ggcFiles.push(file)
        }
      }

      if (window.electronAPI) {
        // Desktop: a dropped folder or .ggc opens ALL .ggc in that directory as tabs.
        let dirPath = null
        if (folderFile) {
          dirPath = window.electronAPI.getPathForFile(folderFile)
        } else if (ggcFiles.length > 0) {
          const filePath = window.electronAPI.getPathForFile(ggcFiles[0])
          dirPath = filePath.slice(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')))
        }
        if (dirPath) {
          await this.openProject({ dirPath })
        } else {
          alert(this.$t('ui.dropGgcAlert'))
        }
        return
      }

      // Web: no directory access — open exactly the dropped .ggc file(s) as tabs.
      if (folderFile) {
        alert(this.$t('ui.dropFolderDesktopOnly'))
        return
      }
      if (ggcFiles.length === 0) {
        alert(this.$t('ui.dropGgcAlert'))
        return
      }
      await this.openDroppedGgcFiles(this.$refs.canvas, ggcFiles)
    },

    /**
     * Check for available autosaves and automatically restore the newest one
     */
    checkForAutosaveRestoration() {
      // Only check if there's no meaningful user data to avoid overwriting current work
      // Don't count empty default circuits as "existing data"
      let hasExistingUserData = false

      // Check if any circuit has actual user content (components or wires)
      for (const [circuitId, circuit] of this.allCircuits) {
        if (circuit.components?.length > 0 || circuit.wires?.length > 0) {
          hasExistingUserData = true
          break
        }
      }

      if (hasExistingUserData) {
        // Skipping autosave restoration - existing user data found
        return
      }

      // No existing user data found - checking for autosaves

      const availableRestores = this.autosave.getAvailableRestores()

      if (availableRestores.length === 0) {
        // No autosaves available for restoration
        return
      }

      // Automatically restore the newest autosave (first in the sorted array)
      const newestAutosave = availableRestores[0]

      if (this.autosave.restoreFromAutosave(newestAutosave.key)) {
        // Autosave restoration successful
        // Force a re-render by updating reactive properties if needed
        this.$nextTick(() => {
          // Navigate to the restored active circuit if it exists
          if (this.activeTabId && this.allCircuits.has(this.activeTabId)) {
            this.switchToTab(this.activeTabId)
          }
        })
      }
    },

    /**
     * Clear the current circuit (all components, wires, and reset to empty state)
     */
    clearCircuit() {
      this.showConfirmation({
        title: this.$t('dialogs.confirmClear'),
        message: this.$t('dialogs.confirmClearMessage'),
        type: 'warning',
        acceptLabel: this.$t('ui.clearCircuit'),
        onAccept: () => {
          // Temporarily disable autosave to prevent saving cleared state
          this.autosave.setAutosaveEnabled(false)

          // Clear all autosave data first
          this.autosave.clearAllAutosaves()

          // Also clear any other circuit-related localStorage data
          this.clearAllCircuitData()

          // Clear the circuit manager data completely
          this.circuitManager.allCircuits.value.clear()
          this.circuitManager.availableComponents.value.clear()
          this.circuitManager.openTabs.value = []

          // Create a fresh main circuit
          this.createNewCircuit()

          // Clear the canvas if it exists
          if (this.$refs.canvas) {
            this.$refs.canvas.clearCircuit()
          }

          // Force a refresh of the selected circuit
          this.selectedCircuit = this.activeCircuit

          // Re-enable autosave after a short delay
          setTimeout(() => {
            this.autosave.setAutosaveEnabled(true)
          }, 1000)
        },
        onReject: () => {
          // User cancelled, do nothing
        }
      })
    },

    /**
     * Aggressively clear all circuit-related localStorage data
     */
    clearAllCircuitData() {
      // Get all localStorage keys
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith('golden-gates-') ||
            key.includes('circuit') ||
            key.includes('autosave') ||
            key.includes('component'))
        ) {
          keysToRemove.push(key)
        }
      }

      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })
    }
  },

  mounted() {
    // localStorage autosave/restore is the persistence layer ONLY for the pure web build. In
    // the desktop app disk (.ggc files) is the single source of truth; autosaving to and
    // silently restoring from localStorage would mask a stale disk and let a student commit
    // work that only ever lived in localStorage. Skip both in Electron — save-on-quit + the
    // per-circuit dirty flags cover persistence there. (Skipping initializeAutosave() means
    // the deep watchers + visibilitychange listener never attach; no restore ⇒ launch blank.)
    if (!window.electronAPI) {
      this.autosave.initializeAutosave()
      this.checkForAutosaveRestoration()
    }

    // Show the open project folder in the OS title bar (document-based-app style — the app name
    // lives in the menu bar), with "— Edited" appended while any circuit has unsaved changes
    // (Pages/Numbers style). The getter reads only currentProjectDir + each circuit's dirty flag,
    // never component values, so it doesn't refire during simulation. document.title flows
    // through to the Electron window title.
    this.$watch(
      () => {
        const dir = this.circuitManager.currentProjectDir.value
        const base = (dir && dir.split(/[\\/]/).filter(Boolean).pop()) || 'Golden Gates'
        const edited = [...this.circuitManager.allCircuits.value.values()].some(
          c => c.hasUnsavedChanges
        )
        return edited ? `${base} — Edited` : base
      },
      title => {
        document.title = title
      },
      { immediate: true }
    )

    // Initialize selectedCircuit with the current circuit if no component is selected
    if (!this.selectedComponent && this.activeCircuit) {
      this.selectedCircuit = this.activeCircuit
    }

    // Set up keyboard shortcuts with direct method calls
    const commandActions = {
      addComponent: type => {
        this.addComponent(type)
      },
      addCircuitComponent: circuitId => {
        this.addCircuitComponent(circuitId)
      },
      createNewCircuit: () => {
        this.createNewCircuit()
      },
      runSimulation: () => {
        this.runSimulation(this.$refs.canvas)
      },
      runTests: () => {
        this.runTests(this.$refs.canvas)
      },
      stopSimulation: () => {
        this.stopSimulation()
      },
      clearCircuit: () => {
        this.clearCircuit()
      },
    }

    // Set up keyboard shortcuts with command actions
    this.setCommandActions(commandActions)

    // Handle project directories opened via OS file association (Electron)
    if (window.electronAPI?.onOpenProject) {
      window.electronAPI.onOpenProject(dirPath => this.openProject(dirPath))
    }

    // Handle native menu bar File actions (Electron)
    if (window.electronAPI?.onMenuNewCircuit) {
      window.electronAPI.onMenuNewCircuit(() => this.createNewCircuit())
    }
    if (window.electronAPI?.onMenuSaveCircuit) {
      window.electronAPI.onMenuSaveCircuit(() => this.saveCircuit(this.$refs.canvas))
    }
    if (window.electronAPI?.onMenuSaveCircuitAs) {
      window.electronAPI.onMenuSaveCircuitAs(() => this.saveCircuitAs(this.$refs.canvas))
    }

    // Save-on-quit bridge (Electron): main.cjs queries these globals when the window is
    // closing so it can prompt to save unsaved circuits before quitting. Uses the same
    // window.__* renderer-global style as the ggl callbacks.
    if (window.electronAPI) {
      window.__ggHasUnsavedChanges = () =>
        [...this.circuitManager.allCircuits.value.values()].some(c => c.hasUnsavedChanges)
      window.__ggSaveAll = async () => {
        try {
          return (await this.saveCircuit(this.$refs.canvas)) !== false
        } catch (e) {
          return false
        }
      }
    }
  },

  watch: {
    // Watch for activeCircuit changes (tab switching) and update selectedCircuit if no component is selected
    activeCircuit(newCircuit) {
      if (!this.selectedComponent && newCircuit) {
        this.selectedCircuit = newCircuit
      }
    }
  },

  beforeUnmount() {
    // Keyboard shortcuts cleanup is handled automatically by useKeyboardShortcuts
  }
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.circuit-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: var(--color-app-bg);
  transition: all 0.2s ease;
}

.circuit-container.drag-over {
  background-color: var(--color-component-selected-fill);
  border: 2px dashed var(--color-component-selected-stroke);
  box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.1);
}

.circuit-container.drag-over::after {
  content: attr(data-drop-message);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--color-component-selected-stroke);
  color: var(--color-text-inverse);
  padding: 1rem 2rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 1.1rem;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* PrimeVue customizations for Aura theme */
.p-tieredmenu {
  min-width: 160px;
  border-radius: 6px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Improve TieredMenu item spacing */
.p-tieredmenu .p-menuitem-link {
  padding: 0.5rem 0.75rem;
  gap: 0.375rem;
  font-size: 0.75rem;
}

.p-tieredmenu .p-menuitem-text {
  margin-left: 0.375rem;
  font-size: 0.75rem;
}

.p-tieredmenu .p-menuitem-icon {
  font-size: 0.75rem;
}

.p-tieredmenu .p-submenu-icon {
  margin-left: auto;
  font-size: 0.625rem;
}

/* Add some vertical padding to menu sections */
.p-tieredmenu .p-menu-list {
  padding: 0.125rem 0;
}

.p-button {
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

/* Improve button appearance */
.p-button.p-button-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.p-button.p-button-sm .p-button-icon {
  font-size: 0.75rem;
}

/* Add spacing between icon and label */
.p-button .p-button-label {
  margin-left: 0.5rem !important;
}

.p-toolbar {
  padding: 0.5rem 0.75rem;
  gap: 0.375rem;
}

/* Improve button spacing in toolbar */
.p-toolbar .p-button + .p-button {
  margin-left: 0.375rem;
}

/* Ensure button text doesn't wrap */
.p-button .p-button-label {
  white-space: nowrap;
}

/* Tooltip styles */
.p-tooltip .p-tooltip-text {
  font-size: 0.625rem;
  padding: 0.375rem 0.625rem;
}

/* Inspector panel styles */
.inspector-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--color-panel-bg);
  border-left: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-medium);
  /* The header sits above the inspector; let the inspector fill the rest and scroll its own
     content. Previously both this panel and the inspector had overflow-y:auto AND the inspector
     was height:100%, so panel = header + full-height inspector always overflowed by the header's
     height, showing a scrollbar even with almost no content. */
  overflow: hidden;
  position: relative;
  transition: width 0.2s ease;
}

.inspector-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0.5rem;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border-light);
}

.inspector-expand,
.inspector-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  z-index: 1000;
  pointer-events: auto;
}

.inspector-expand:hover,
.inspector-close:hover {
  background-color: var(--color-component-hover-fill);
  color: var(--color-text-primary);
}

/* Subtle simulation loading indicator */
.simulation-loading {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-panel-bg);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  box-shadow: var(--shadow-medium);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.simulation-loading i {
  color: var(--color-button-primary);
  font-size: 1rem;
}

.simulation-loading span {
  font-weight: 500;
}
</style>
