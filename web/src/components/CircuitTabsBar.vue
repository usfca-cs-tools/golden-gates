<template>
  <div v-if="circuitTabs.length > 0" class="circuit-tabs-container">
    <Button
      v-if="showScrollButtons"
      icon="pi pi-chevron-left"
      class="tab-scroll-button tab-scroll-left"
      @click="scrollTabs('left')"
      text
      size="small"
      :disabled="!canScrollLeft"
    />
    <div class="circuit-tabs" ref="tabsContainer">
      <Button
        v-for="tab in circuitTabs"
        :key="tab.id"
        :label="tab.name"
        :class="['circuit-tab', { active: tab.id === activeTabId }]"
        @click="switchToTab(tab.id)"
        text
        size="small"
      >
        <template #default>
          <span class="tab-content">
            <span class="tab-name">{{ tab.name }}</span>
            <div
              v-if="circuitTabs.length > 1"
              class="tab-close-container"
              @click.stop="handleCloseTab(tab.id)"
              :class="{ 'has-unsaved-changes': hasCircuitUnsavedWork(tab.id, circuitManager) }"
            >
              <!-- Show dot for unsaved changes, X shown via CSS pseudo-element -->
              <i v-if="hasCircuitUnsavedWork(tab.id, circuitManager)" class="unsaved-dot"></i>
            </div>
          </span>
        </template>
      </Button>
    </div>
    <Button
      v-if="showScrollButtons"
      icon="pi pi-chevron-right"
      class="tab-scroll-button tab-scroll-right"
      @click="scrollTabs('right')"
      text
      size="small"
      :disabled="!canScrollRight"
    />
  </div>
</template>

<script>
import { useTabManagement } from '../composables/useTabManagement'
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
  name: 'CircuitTabsBar',
  props: {
    circuitTabs: {
      type: Array,
      required: true
    },
    activeTabId: {
      type: String,
      required: true
    },
    circuitManager: {
      type: Object,
      required: true
    }
  },
  emits: ['switchToTab', 'closeTab', 'showConfirmation'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const {
      showScrollButtons,
      canScrollLeft,
      canScrollRight,
      tabsContainer,
      scrollTabs,
      updateScrollButtonStates,
      checkTabOverflow,
      hasCircuitUnsavedWork
    } = useTabManagement()

    function switchToTab(tabId) {
      emit('switchToTab', tabId)
    }

    function handleCloseTab(circuitId) {
      // Check if the circuit has unsaved changes
      if (hasCircuitUnsavedWork(circuitId, props.circuitManager)) {
        emit('showConfirmation', {
          title: t('dialogs.unsavedChanges'),
          message: t('dialogs.unsavedChangesMessage'),
          type: 'warning',
          acceptLabel: t('ui.closeWithoutSaving'),
          onAccept: () => {
            emit('closeTab', circuitId)
          },
          onReject: () => {
            // User cancelled, do nothing
          }
        })
      } else {
        // No unsaved changes, close immediately
        emit('closeTab', circuitId)
      }
    }

    // Set up event listeners
    onMounted(() => {
      window.addEventListener('resize', updateScrollButtonStates)
      checkTabOverflow()
    })

    onUnmounted(() => {
      window.removeEventListener('resize', updateScrollButtonStates)
    })

    // Watch for tab changes to update scroll button states
    watch(
      () => props.circuitTabs,
      () => {
        checkTabOverflow()
      },
      { deep: true }
    )

    return {
      showScrollButtons,
      canScrollLeft,
      canScrollRight,
      tabsContainer,
      scrollTabs,
      switchToTab,
      handleCloseTab,
      hasCircuitUnsavedWork
    }
  }
}
</script>

<style scoped>
/* Circuit tabs container with navigation */
.circuit-tabs-container {
  display: flex;
  align-items: center;
  margin-left: 1rem;
  margin-right: 1rem;
  max-width: calc(100vw - 400px); /* Leave space for other toolbar elements */
}

.circuit-tabs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  flex-wrap: nowrap;
  flex: 1;
  /* Hide scrollbar for cleaner appearance since we have navigation buttons */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.circuit-tabs::-webkit-scrollbar {
  display: none;
}

/* Tab scroll navigation buttons */
.tab-scroll-button {
  padding: 0.25rem !important;
  min-width: auto !important;
  height: auto !important;
  border-radius: 4px !important;
  color: var(--color-text-secondary) !important;
  background-color: transparent !important;
  border-color: transparent !important;
  flex-shrink: 0;
  margin: 0 0.125rem;
}

.tab-scroll-button:hover:not(:disabled) {
  background-color: var(--color-component-hover-fill) !important;
  color: var(--color-text-primary) !important;
}

.tab-scroll-button:disabled {
  opacity: 0.3 !important;
  cursor: not-allowed !important;
}

.circuit-tab {
  padding: 0.25rem 0.75rem !important;
  font-size: 0.75rem !important;
  min-height: auto !important;
  height: auto !important;
  border-radius: 4px !important;
  color: var(--color-text-secondary) !important;
  background-color: transparent !important;
  border-color: transparent !important;
  font-weight: 400 !important;
  position: relative;
  max-width: 160px;
  min-width: 60px;
  overflow: hidden;
  flex-shrink: 0;
}

/* Lay out name + close/badge as a row so a long name truncates instead of pushing the
   close box and unsaved dot out past the tab's clipped edge. */
.circuit-tab :deep(.p-button-label) {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}
.tab-content {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}
.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1 1 auto;
}

.circuit-tab:hover {
  background-color: var(--color-component-hover-fill) !important;
  color: var(--color-text-primary) !important;
}

.circuit-tab.active {
  background-color: var(--color-component-hover-fill) !important;
  color: var(--color-text-primary) !important;
  font-weight: 500 !important;
}

/* Tab close button container */
.tab-close-container {
  margin-left: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.tab-close-container:hover {
  background-color: var(--color-component-hover-fill);
}

/* Tab close icon (X) - use pseudo-element for consistent sizing */
.tab-close-container:not(.has-unsaved-changes)::after {
  content: '×';
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--color-text-secondary);
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  width: 16px;
  height: 16px;
  transition: opacity 0.2s ease;
}

.tab-close-container:not(.has-unsaved-changes):hover::after {
  opacity: 1;
}

/* Unsaved changes dot */
.unsaved-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-text-secondary);
  opacity: 1 !important;
  transition: all 0.2s ease;
}

.circuit-tab.active .unsaved-dot {
  background-color: var(--color-text-primary);
}

/* Show X instead of dot on hover */
.tab-close-container.has-unsaved-changes:hover .unsaved-dot {
  display: none;
}

.tab-close-container.has-unsaved-changes:hover::after {
  content: '×';
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  width: 16px;
  height: 16px;
}
</style>
