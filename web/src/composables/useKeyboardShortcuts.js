import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAllCommands, getDynamicComponentCommands } from '../config/commands'

export function useKeyboardShortcuts(commandActions, availableComponents = []) {
  const { t } = useI18n()

  // Store command actions reference that can be updated later
  let currentCommandActions = commandActions
  // Detect platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Parse shortcut string into key components
  function parseShortcut(shortcut) {
    const parts = shortcut.split('+')
    const key = parts[parts.length - 1].toLowerCase()

    return {
      key,
      // Use ctrlKey on all platforms to avoid browser conflicts
      metaKey: false,
      ctrlKey: parts.includes('Cmd') || parts.includes('Ctrl'),
      shiftKey: parts.includes('Shift'),
      altKey: parts.includes('Alt')
    }
  }

  // Check if keyboard event matches shortcut
  function matchesShortcut(event, shortcut) {
    const parsed = parseShortcut(shortcut)

    // Special handling for Enter key
    const eventKey = event.key === 'Enter' ? 'enter' : event.key.toLowerCase()

    return (
      eventKey === parsed.key &&
      event.metaKey === parsed.metaKey &&
      event.ctrlKey === parsed.ctrlKey &&
      event.shiftKey === parsed.shiftKey &&
      event.altKey === parsed.altKey
    )
  }

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

    // Every shortcut below is an unmodified single key (r, t, ., c, a). Ignore anything with a
    // Cmd/Ctrl/Alt modifier so these don't hijack system combos — e.g. Cmd+C must stay copy
    // (not Step Clock, which is bare "c") and Cmd+R must stay reload (not Run, bare "r").
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    // Handle single-key shortcuts
    const key = event.key.toLowerCase()

    // Get localized shortcut keys
    const shortcuts = {
      run: t('shortcuts.run').toLowerCase(),
      runTests: t('shortcuts.runTests').toLowerCase(),
      stop: t('shortcuts.stop').toLowerCase(),
      step: t('shortcuts.step').toLowerCase(),
      again: t('shortcuts.again').toLowerCase()
    }

    // Handle "Again" - execute top recently used command
    if (key === shortcuts.again) {
      event.preventDefault()
      // Get recent commands from localStorage or a global store
      const recentCommandIds = JSON.parse(localStorage.getItem('recentCommands') || '[]')
      if (recentCommandIds.length > 0) {
        // Include both static and dynamic commands in search
        const staticCommands = getAllCommands()
        // Ensure availableComponents is an array (handle reactive computed values)
        const componentsArray = Array.isArray(availableComponents)
          ? availableComponents
          : availableComponents?.value || []
        const dynamicCommands = getDynamicComponentCommands(componentsArray)
        const allCommands = [...staticCommands, ...dynamicCommands]
        const topRecentCommand = allCommands.find(cmd => cmd.id === recentCommandIds[0])
        if (topRecentCommand && currentCommandActions?.[topRecentCommand.action]) {
          const params = topRecentCommand.params || []
          currentCommandActions[topRecentCommand.action](...params)
        }
      }
      return
    }

    // Get all commands with shortcut keys and check if any match
    const commands = getAllCommands().filter(cmd => cmd.shortcutKey)

    for (const command of commands) {
      const shortcutKey = shortcuts[command.shortcutKey]
      if (shortcutKey && key === shortcutKey && currentCommandActions?.[command.action]) {
        event.preventDefault()
        const params = command.params || []
        currentCommandActions[command.action](...params)
        break
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
