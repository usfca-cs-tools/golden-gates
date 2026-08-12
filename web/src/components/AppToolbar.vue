<template>
  <Toolbar class="app-toolbar">
    <template #start>
      <Button
        class="p-button-sm golden-gate-button"
        @click="$emit('openCommandPalette')"
        v-tooltip.right="commandPaletteTooltip"
      >
        <GoldenGateLogo :width="48" :height="24" />
      </Button>

      <Button
        icon="pi pi-sidebar"
        class="p-button-text p-button-sm toolbar-toggle"
        @click="$emit('toggleSidebar')"
        v-tooltip.right="$t('ui.toggleSidebar')"
      />

      <CircuitTabsBar
        :circuitTabs="circuitTabs"
        :activeTabId="activeTabId"
        :circuitManager="circuitManager"
        @switchToTab="$emit('switchToTab', $event)"
        @closeTab="$emit('closeTab', $event)"
        @showConfirmation="$emit('showConfirmation', $event)"
      />
    </template>
    <template #end>
      <Button
        icon="pi pi-sliders-h"
        class="p-button-text p-button-sm toolbar-toggle"
        @click="$emit('toggleInspector')"
        v-tooltip.left="$t('ui.toggleInspector')"
      />
    </template>
  </Toolbar>
</template>

<script>
import CircuitTabsBar from './CircuitTabsBar.vue'
import GoldenGateLogo from './GoldenGateLogo.vue'
import { useI18n } from 'vue-i18n'

export default {
  name: 'AppToolbar',
  components: {
    CircuitTabsBar,
    GoldenGateLogo
  },
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
  emits: [
    'openCommandPalette',
    'switchToTab',
    'closeTab',
    'showConfirmation',
    'toggleInspector',
    'toggleSidebar'
  ],
  setup() {
    const { t } = useI18n()

    const commandPaletteTooltip = `${t('commands.commandPalette.title')} (G)`

    return {
      commandPaletteTooltip
    }
  }
}
</script>

<style scoped>
.app-toolbar {
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-toolbar-bg);
  box-shadow: var(--shadow-small);
  height: 48px;
}

/* Inspector toggle button styling */
.p-button-text {
  color: var(--color-text-secondary) !important;
  background-color: transparent !important;
  border-color: transparent !important;
}

/* Enlarge the toolbar toggle icons (sidebar + inspector). At the theme's p-button-sm icon size
   (0.875rem) they read small, and the pi-sidebar glyph especially under-fills its em box. The
   theme rule (.p-button.p-button-sm .p-button-icon) ties this on specificity, so !important wins
   it — consistent with the button overrides above. */
.toolbar-toggle :deep(.p-button-icon) {
  font-size: 1.25rem !important;
}

.p-button-text:hover {
  color: var(--color-text-primary) !important;
  background-color: var(--color-component-hover-fill) !important;
  border-color: transparent !important;
}

/* Golden Gate button styling with USF colors */
.golden-gate-button {
  padding: 0.375rem 0.875rem !important;
  min-width: auto !important;
  background-color: #00543c !important; /* USF Green */
  border-color: #00543c !important;
  color: #ffcc02 !important; /* USF Gold */
}

.golden-gate-button:hover {
  background-color: #004832 !important; /* Darker USF Green */
  border-color: #004832 !important;
  color: #ffd633 !important; /* Brighter USF Gold */
}

.golden-gate-button .golden-gate-logo {
  color: #ffcc02; /* USF Gold */
  transition: color 0.2s ease;
}

.golden-gate-button:hover .golden-gate-logo {
  color: #ffd633; /* Brighter USF Gold */
}

.golden-gate-button .logo-tower-left,
.golden-gate-button .logo-tower-right {
  fill: #ffcc02; /* USF Gold towers */
}

.golden-gate-button:hover .logo-tower-left,
.golden-gate-button:hover .logo-tower-right {
  fill: #ffd633; /* Brighter USF Gold towers */
}

/* Dark mode support */
.p-dark .golden-gate-button {
  background-color: #006b4d !important; /* Lighter USF Green for dark mode */
  border-color: #006b4d !important;
}

.p-dark .golden-gate-button:hover {
  background-color: #007d58 !important;
  border-color: #007d58 !important;
}
</style>
