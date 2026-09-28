<template>
  <Toolbar class="app-toolbar">
    <template #start>
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

export default {
  name: 'AppToolbar',
  components: {
    CircuitTabsBar
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
  emits: ['switchToTab', 'closeTab', 'showConfirmation', 'toggleInspector', 'toggleSidebar']
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
</style>
