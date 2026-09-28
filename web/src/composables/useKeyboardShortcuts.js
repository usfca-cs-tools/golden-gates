import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

export function useKeyboardShortcuts(commandActions) {
  const { t } = useI18n()

  // Store command actions reference that can be updated later
  let currentCommandActions = commandActions
  // Detect platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

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

    // "Again" is the one remaining unmodified single-key shortcut. Ignore Cmd/Ctrl/Alt combos so
    // it doesn't hijack system shortcuts (the simulation verbs now live in the native menu with
    // Cmd/Ctrl accelerators — see main.cjs).
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
