import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

export function useKeyboardShortcuts(commandActions) {
  const { t } = useI18n()

  // Store command actions reference that can be updated later
  let currentCommandActions = commandActions
  // Detect platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  // In the Electron desktop build the native Simulation menu owns Run/Step/Stop/Run Tests via
  // Cmd/Ctrl accelerators (see main.cjs). The bare-key fallbacks below are for the browser build
  // only, where there's no native menu — a developer convenience that predates it.
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  // Handle global keyboard shortcuts
  function handleGlobalKeyDown(event) {
    // Don't trigger shortcuts when typing in input fields
    const target = event.target
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.isContentEditable ||
      target.closest('.p-inputtext') ||
      target.closest('.p-inputnumber') ||
      target.closest('input')
    ) {
      return
    }

    // These are unmodified single-key shortcuts. Ignore Cmd/Ctrl/Alt combos so they don't hijack
    // system shortcuts (e.g. Cmd+R must stay browser reload, not Run).
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    const key = event.key.toLowerCase()

    // "Again" - replay the last insert recorded by App.handleCommand (gg.lastCommand).
    if (key === t('shortcuts.again').toLowerCase()) {
      event.preventDefault()
      let last = null
      try {
        const raw = localStorage.getItem('gg.lastCommand')
        last = raw ? JSON.parse(raw) : null
      } catch (e) {
        last = null
      }
      if (last && currentCommandActions?.[last.action]) {
        currentCommandActions[last.action](...(last.params || []))
      }
      return
    }

    // Browser-only bare-key simulation shortcuts (the desktop build uses the native Simulation
    // menu instead). Kept for developers working in the web build.
    if (!isElectron) {
      const simActions = {
        [t('shortcuts.run').toLowerCase()]: 'runSimulation',
        [t('shortcuts.runTests').toLowerCase()]: 'runTests',
        [t('shortcuts.stop').toLowerCase()]: 'stopSimulation',
        [t('shortcuts.step').toLowerCase()]: 'stepClock'
      }
      const action = simActions[key]
      if (action && currentCommandActions?.[action]) {
        event.preventDefault()
        currentCommandActions[action]()
      }
    }
  }

  // Set up and tear down keyboard listener
  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeyDown)
  })

  // Function to update command actions (called from mounted)
  function setCommandActions(actions) {
    currentCommandActions = actions
  }

  return {
    isMac,
    setCommandActions
  }
}
