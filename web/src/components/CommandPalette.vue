<template>
  <Dialog
    v-model:visible="visible"
    :modal="true"
    :closable="true"
    :showHeader="false"
    :dismissableMask="true"
    @hide="onHide"
    :pt="{
      root: 'command-palette-dialog',
      content: 'command-palette-content'
    }"
  >
    <div class="command-palette">
      <div class="command-palette-search">
        <i class="pi pi-search search-icon"></i>
        <input
          ref="searchInput"
          v-model="searchQuery"
          :placeholder="$t('commands.commandPalette.placeholder')"
          class="command-palette-input"
          @keydown="handleKeyDown"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </div>

      <div class="command-palette-results" ref="resultsContainer">
        <div v-if="filteredCommands.length === 0" class="no-results">
          {{ $t('commands.commandPalette.noResults') }}
        </div>

        <template v-else>
          <div v-if="recentCommands.length > 0" class="command-group">
            <div class="command-group-header">
              {{ $t('commands.commandPalette.recentlyUsed') }}
              <span class="command-group-hint">{{ $t('commands.commandPalette.againHint') }}</span>
            </div>
            <div
              v-for="(command, index) in recentCommands"
              :key="`recent-${command.id}`"
              :class="['command-item', { selected: selectedIndex === index }]"
              @click="executeCommand(command)"
              @mouseenter="selectedIndex = index"
            >
              <ComponentIcon
                v-if="command.componentType"
                :componentType="command.componentType"
                :size="16"
                class="command-icon"
              />
              <i v-else-if="command.icon" :class="command.icon" class="command-icon"></i>
              <span class="command-label">{{ getCommandLabel(command) }}</span>
              <span v-if="getCommandShortcut(command)" class="command-shortcut">{{
                formatShortcut(getCommandShortcut(command))
              }}</span>
            </div>
          </div>

          <div
            v-for="[groupKey, commands] in groupedCommands"
            :key="groupKey"
            class="command-group"
          >
            <div class="command-group-header">{{ $t(commands[0].groupLabelKey) }}</div>
            <div
              v-for="(command, index) in commands"
              :key="command.id"
              :class="[
                'command-item',
                { selected: selectedIndex === getGlobalIndex(groupKey, index) }
              ]"
              @click="executeCommand(command)"
              @mouseenter="selectedIndex = getGlobalIndex(groupKey, index)"
            >
              <ComponentIcon
                v-if="command.componentType"
                :componentType="command.componentType"
                :size="16"
                class="command-icon"
              />
              <i v-else-if="command.icon" :class="command.icon" class="command-icon"></i>
              <span class="command-label">{{ getCommandLabel(command) }}</span>
              <span v-if="getCommandShortcut(command)" class="command-shortcut">{{
                formatShortcut(getCommandShortcut(command))
              }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Dialog>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ComponentIcon from './ComponentIcon.vue'
import { commandGroups, getAllCommands, getDynamicComponentCommands } from '../config/commands'

export default {
  name: 'CommandPalette',
  components: {
    ComponentIcon
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    availableComponents: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue', 'command'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const searchQuery = ref('')
    const selectedIndex = ref(0)
    const searchInput = ref(null)
    const resultsContainer = ref(null)
    const recentCommandIds = ref(JSON.parse(localStorage.getItem('recentCommands') || '[]'))

    const visible = computed({
      get: () => props.modelValue,
      set: value => emit('update:modelValue', value)
    })

    // Get all static commands plus dynamic component commands
    const allCommands = computed(() => {
      const staticCommands = getAllCommands()
      const dynamicCommands = getDynamicComponentCommands(props.availableComponents)
      return [...staticCommands, ...dynamicCommands]
    })

    // Get recent commands
    const recentCommands = computed(() => {
      if (searchQuery.value) {
        // When searching, filter recent commands too
        const query = searchQuery.value.toLowerCase()
        return recentCommandIds.value
          .map(id => allCommands.value.find(cmd => cmd.id === id))
          .filter(cmd => {
            if (!cmd) return false
            const label = getCommandLabel(cmd).toLowerCase()
            return label.includes(query)
          })
          .slice(0, 5)
      }

      // When not searching, show all recent
      return recentCommandIds.value
        .map(id => allCommands.value.find(cmd => cmd.id === id))
        .filter(Boolean)
        .slice(0, 5)
    })

    // Filter commands based on search query
    const filteredCommands = computed(() => {
      if (!searchQuery.value) {
        return allCommands.value
      }

      const query = searchQuery.value.toLowerCase()
      const filtered = allCommands.value.filter(command => {
        const label = getCommandLabel(command).toLowerCase()
        return label.includes(query)
      })

      // Sort results: prioritize commands that start with the query
      return filtered.sort((a, b) => {
        const aLabel = getCommandLabel(a).toLowerCase()
        const bLabel = getCommandLabel(b).toLowerCase()
        const aStartsWith = aLabel.startsWith(query)
        const bStartsWith = bLabel.startsWith(query)

        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1
        return 0
      })
    })

    // Group filtered commands by category
    const groupedCommands = computed(() => {
      const groups = new Map()

      filteredCommands.value.forEach(command => {
        // Always show commands in their static groups to maintain visual/muscle memory
        // Commands can appear in both Recent and static groups simultaneously
        const groupKey = command.groupKey
        if (!groups.has(groupKey)) {
          groups.set(groupKey, [])
        }
        groups.get(groupKey).push(command)
      })

      return groups
    })

    // Get command label
    function getCommandLabel(command) {
      return command.labelKey ? t(command.labelKey) : command.label
    }

    // Detect platform
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    // Get localized shortcut for a command
    function getCommandShortcut(command) {
      if (!command.shortcutKey) return null

      // Map shortcutKey to localized shortcut
      const shortcuts = {
        run: t('shortcuts.run'),
        save: t('shortcuts.save'),
        open: t('shortcuts.open'),
        stop: t('shortcuts.stop'),
        step: t('shortcuts.step'),
        again: t('shortcuts.again')
      }

      return shortcuts[command.shortcutKey]
    }

    // Format keyboard shortcut for display
    function formatShortcut(shortcut) {
      // For single-key shortcuts, just return the key
      if (shortcut && shortcut.length === 1) {
        return shortcut.toUpperCase()
      }

      // Legacy formatting for any complex shortcuts
      if (isMac) {
        return shortcut
          .replace(/Cmd/g, '⌃')
          .replace(/Ctrl/g, '⌃')
          .replace(/Alt/g, '⌥')
          .replace(/Shift/g, '⇧')
          .replace(/\+/g, '')
      } else {
        return shortcut.replace(/Cmd/g, 'Ctrl').replace(/Alt/g, 'Alt').replace(/Shift/g, 'Shift')
      }
    }

    // Get global index for keyboard navigation
    function getGlobalIndex(groupKey, localIndex) {
      let globalIndex = recentCommands.value.length

      for (const [key, commands] of groupedCommands.value) {
        if (key === groupKey) {
          return globalIndex + localIndex
        }
        globalIndex += commands.length
      }

      return globalIndex
    }

    // Handle keyboard navigation
    function handleKeyDown(event) {
      const totalItems =
        recentCommands.value.length +
        Array.from(groupedCommands.value.values()).reduce((sum, cmds) => sum + cmds.length, 0)

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          selectedIndex.value = (selectedIndex.value + 1) % totalItems
          scrollToSelected()
          break

        case 'ArrowUp':
          event.preventDefault()
          selectedIndex.value = (selectedIndex.value - 1 + totalItems) % totalItems
          scrollToSelected()
          break

        case 'Enter':
          event.preventDefault()
          executeSelectedCommand()
          break

        case 'Escape':
          event.preventDefault()
          visible.value = false
          break

        case 'a':
        case 'A':
          // Don't execute commands when typing - let the user type "AND" etc.
          // Just stop propagation to prevent global shortcuts
          event.stopPropagation()
          break

        default:
          // For all other keys, stop propagation to prevent global shortcuts
          event.stopPropagation()
          break
      }
    }

    // Scroll to keep selected item visible
    function scrollToSelected() {
      nextTick(() => {
        const selected = resultsContainer.value?.querySelector('.command-item.selected')
        if (selected && resultsContainer.value) {
          const containerRect = resultsContainer.value.getBoundingClientRect()
          const selectedRect = selected.getBoundingClientRect()

          if (selectedRect.bottom > containerRect.bottom) {
            selected.scrollIntoView({ block: 'end', behavior: 'smooth' })
          } else if (selectedRect.top < containerRect.top) {
            selected.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }
        }
      })
    }

    // Execute selected command
    function executeSelectedCommand() {
      let currentIndex = 0

      // Check recent commands (only shown when not searching)
      if (!searchQuery.value && selectedIndex.value < recentCommands.value.length) {
        executeCommand(recentCommands.value[selectedIndex.value])
        return
      }

      currentIndex = searchQuery.value ? 0 : recentCommands.value.length

      // Check grouped commands
      for (const commands of groupedCommands.value.values()) {
        if (selectedIndex.value < currentIndex + commands.length) {
          executeCommand(commands[selectedIndex.value - currentIndex])
          return
        }
        currentIndex += commands.length
      }
    }

    // Execute a command
    function executeCommand(command) {
      // Add to recent commands
      recentCommandIds.value = [
        command.id,
        ...recentCommandIds.value.filter(id => id !== command.id)
      ].slice(0, 10)

      // Persist to localStorage
      localStorage.setItem('recentCommands', JSON.stringify(recentCommandIds.value))

      // Close palette first to ensure it closes even if command fails
      visible.value = false

      // Then emit command event
      nextTick(() => {
        emit('command', {
          action: command.action,
          params: command.params || []
        })
      })
    }

    // Reset state when closing
    function onHide() {
      searchQuery.value = ''
      selectedIndex.value = 0
    }

    // Focus search input when opened
    watch(visible, newValue => {
      if (newValue) {
        nextTick(() => {
          searchInput.value?.focus()
        })
      }
    })

    // Reset selected index when search changes
    watch(searchQuery, () => {
      selectedIndex.value = 0
    })

    return {
      visible,
      searchQuery,
      selectedIndex,
      searchInput,
      resultsContainer,
      recentCommands,
      filteredCommands,
      groupedCommands,
      getCommandLabel,
      formatShortcut,
      getCommandShortcut,
      getGlobalIndex,
      handleKeyDown,
      executeCommand,
      executeSelectedCommand,
      onHide
    }
  }
}
</script>

<style>
.command-palette-dialog {
  width: 90vw;
  max-width: 600px;
  margin-top: 10vh;
  border-radius: 0.5rem !important;
}

.command-palette-content {
  padding: 0 !important;
  border-radius: 0.5rem !important;
  overflow: hidden;
}

.command-palette {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow: hidden;
}

.command-palette-search {
  position: relative;
  border-bottom: 1px solid var(--surface-border);
  border-radius: 0.5rem 0.5rem 0 0;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.command-palette-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: none;
  outline: none;
  font-size: 0.875rem;
  background: transparent;
  color: var(--color-text-primary);
}

.command-palette-input::placeholder {
  color: var(--color-text-secondary);
}

.command-palette-results {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.no-results {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.command-group {
  margin-bottom: 0.5rem;
}

.command-group-header {
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.command-group-hint {
  font-size: 0.625rem;
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  opacity: 0.7;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.command-item:hover,
.command-item.selected {
  background-color: var(--color-component-selected-fill);
  color: var(--color-text-primary);
}

.command-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.command-label {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.command-shortcut {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  background-color: var(--color-component-hover-fill);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
  letter-spacing: 0.05em;
  font-weight: 500;
  border: 1px solid var(--color-border-light);
}

/* Dark mode support */
.p-dark .command-palette-input {
  background: transparent;
}
</style>
