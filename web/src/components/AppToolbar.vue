<template>
  <Toolbar :class="['app-toolbar', { 'mac-title-bar': macTitleBar }]">
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
      <!-- Desktop: which project folder this window has open, so several Golden Gates windows can
           be told apart at a glance. Hover for the full path. -->
      <div
        v-if="isDesktop"
        class="project-folder"
        :class="{ 'no-folder': !projectDir }"
        :title="projectDir || undefined"
      >
        <i class="pi pi-folder"></i>
        <span class="project-folder-name">{{ projectDisplayName }}</span>
      </div>
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
import { projectFolderName } from '../utils/projectFolder'

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
  emits: ['switchToTab', 'closeTab', 'showConfirmation', 'toggleInspector', 'toggleSidebar'],
  computed: {
    projectDir() {
      return this.circuitManager.currentProjectDir?.value || ''
    },
    projectDisplayName() {
      return this.projectDir ? projectFolderName(this.projectDir) : this.$t('ui.noFolderOpen')
    }
  },
  data() {
    return {
      // Project folders only exist in the desktop app; the web build has none to show.
      isDesktop: typeof window !== 'undefined' && !!window.electronAPI,
      // The macOS desktop app hides the native title bar (main.cjs), so this toolbar becomes the
      // window's drag region and makes room for the traffic lights. Web and Windows are unchanged.
      macTitleBar:
        typeof window !== 'undefined' &&
        !!window.electronAPI &&
        navigator.platform.toUpperCase().indexOf('MAC') >= 0
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

/* macOS desktop: the toolbar stands in for the hidden title bar (issue #141). Empty toolbar space
   drags the window; every control is a <button> (the tab close box sits inside its tab's button),
   so exempting buttons keeps them all clickable. The left padding clears the traffic lights. */
.app-toolbar.mac-title-bar {
  -webkit-app-region: drag;
  padding-left: 80px !important;
}

.app-toolbar.mac-title-bar :deep(button) {
  -webkit-app-region: no-drag;
}

/* Project folder label (desktop). Matches the All Circuits menu header: brand-colored folder
   icon + name. Long names truncate; the full path is in the hover tooltip. */
.project-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  margin-right: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--color-text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}
.project-folder .pi-folder {
  font-size: 13px;
  color: var(--color-brand-primary);
}
.project-folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-folder.no-folder {
  font-weight: 500;
  color: var(--color-text-secondary);
}
.project-folder.no-folder .pi-folder {
  color: var(--color-text-secondary);
}

/* The mac title bar is a drag region, which swallows hover; opt the label out so its full-path
   tooltip still shows. */
.app-toolbar.mac-title-bar .project-folder {
  -webkit-app-region: no-drag;
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
