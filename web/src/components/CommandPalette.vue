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
      <div
        class="command-palette-results"
        ref="resultsContainer"
        tabindex="0"
        @keydown="handleKeyDown"
      >
        <div v-for="group in groups" :key="group.key" class="command-group">
          <div class="command-group-header">{{ $t(group.labelKey) }}</div>
          <div
            v-for="command in group.items"
            :key="command.id"
            :class="['command-item', { selected: selectedIndex === indexOf(command) }]"
            @click="executeCommand(command)"
            @mouseenter="selectedIndex = indexOf(command)"
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
      </div>
    </div>
  </Dialog>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ComponentIcon from './ComponentIcon.vue'
import { getVerbGroups } from '../config/commands'

// "Again" replays the last insert (recorded by App.handleCommand). It's a verb, so it lives
// in the palette alongside the file/simulation actions rather than in the insert sidebar.
const AGAIN_COMMAND = {
  id: 'again',
  labelKey: 'commands.again',
  icon: 'pi pi-replay',
  action: 'again',
  shortcutKey: 'again'
}

export default {
  name: 'CommandPalette',
  components: {
    ComponentIcon
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'command'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const selectedIndex = ref(0)
    const resultsContainer = ref(null)

    const visible = computed({
      get: () => props.modelValue,
      set: value => emit('update:modelValue', value)
    })

    // Verb + file-action groups (separators dropped — grouping already visually divides them),
    // with "Again" appended to the simulation group. Copied, so the shared commandGroups source
    // is never mutated.
    const groups = computed(() =>
      getVerbGroups().map(group => {
        const items = group.items.filter(item => !item.separator)
        return {
          ...group,
          items: group.key === 'simulation' ? [...items, AGAIN_COMMAND] : items
        }
      })
    )

    // Flat list mirroring render order, for keyboard navigation.
    const flatCommands = computed(() => groups.value.flatMap(g => g.items))

    function indexOf(command) {
      return flatCommands.value.findIndex(c => c.id === command.id)
    }

    function getCommandLabel(command) {
      return command.labelKey ? t(command.labelKey) : command.label
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    function getCommandShortcut(command) {
      if (!command.shortcutKey) return null

      const shortcuts = {
        run: t('shortcuts.run'),
        runTests: t('shortcuts.runTests'),
        save: t('shortcuts.save'),
        open: t('shortcuts.open'),
        stop: t('shortcuts.stop'),
        step: t('shortcuts.step'),
        again: t('shortcuts.again')
      }

      return shortcuts[command.shortcutKey]
    }

    function formatShortcut(shortcut) {
      if (shortcut && shortcut.length === 1) {
        return shortcut.toUpperCase()
      }

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

    function handleKeyDown(event) {
      const total = flatCommands.value.length

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          selectedIndex.value = (selectedIndex.value + 1) % total
          scrollToSelected()
          break

        case 'ArrowUp':
          event.preventDefault()
          selectedIndex.value = (selectedIndex.value - 1 + total) % total
          scrollToSelected()
          break

        case 'Enter':
          event.preventDefault()
          executeCommand(flatCommands.value[selectedIndex.value])
          break

        case 'Escape':
          event.preventDefault()
          visible.value = false
          break

        default:
          // Stop propagation so global single-key shortcuts don't fire while the palette is open.
          event.stopPropagation()
          break
      }
    }

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

    function executeCommand(command) {
      // Close palette first to ensure it closes even if the command fails.
      visible.value = false

      nextTick(() => {
        emit('command', {
          action: command.action,
          params: command.params || []
        })
      })
    }

    function onHide() {
      selectedIndex.value = 0
    }

    // Focus the results container on open so arrow/Enter navigation works without a text input.
    watch(visible, newValue => {
      if (newValue) {
        selectedIndex.value = 0
        nextTick(() => {
          resultsContainer.value?.focus()
        })
      }
    })

    return {
      visible,
      selectedIndex,
      resultsContainer,
      groups,
      indexOf,
      getCommandLabel,
      formatShortcut,
      getCommandShortcut,
      handleKeyDown,
      executeCommand,
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

.command-palette-results {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
  outline: none;
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
</style>
