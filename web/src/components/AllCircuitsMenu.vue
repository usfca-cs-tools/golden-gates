<template>
  <div class="all-circuits" ref="root">
    <button
      type="button"
      class="all-btn"
      :class="{ 'is-open': menuOpen }"
      :title="projectDir || undefined"
      @click="toggle"
    >
      {{ $t('ui.allCircuits') }}
      <i class="pi pi-chevron-down chev"></i>
    </button>

    <div v-if="menuOpen" class="menu" role="menu">
      <div class="menu-head" :title="projectDir || undefined">
        <i class="pi pi-folder folder"></i>
        <span class="head-name">{{ projectName }}</span>
        <span class="head-count">{{ circuits.length }}</span>
      </div>

      <div class="menu-search">
        <i class="pi pi-search"></i>
        <input
          ref="filter"
          v-model="filter"
          type="text"
          :placeholder="$t('ui.filterCircuits')"
          spellcheck="false"
        />
      </div>

      <div class="menu-list">
        <button
          v-for="c in filteredCircuits"
          :key="c.id"
          type="button"
          class="row"
          :class="{ active: c.id === activeTabId }"
          @click="openCircuit(c.id)"
        >
          <span class="slot"><span :class="c.isOpen ? 'g-open' : 'g-closed'"></span></span>
          <span class="row-name">{{ c.name }}</span>
          <span v-if="c.isDirty" class="rdot" :title="$t('ui.unsavedChanges')"></span>
        </button>
        <div v-if="filteredCircuits.length === 0" class="empty">{{ $t('ui.noCircuitsMatch') }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { useTabManagement } from '../composables/useTabManagement'

// The project's circuit list. Lists EVERY circuit in the open folder (not just the ones in tabs),
// so a closed circuit can be reopened. It's derived from the in-memory circuitManager — read when
// rendered, kept in sync with in-app changes; it does not watch the disk.
export default {
  name: 'AllCircuitsMenu',
  props: {
    circuitManager: { type: Object, required: true },
    activeTabId: { type: String, default: null }
  },
  setup() {
    // Same "is dirty" source the tabs use, so the menu dot and the tab dot always agree.
    const { hasCircuitUnsavedWork } = useTabManagement()
    return { hasCircuitUnsavedWork }
  },
  data() {
    return { menuOpen: false, filter: '' }
  },
  computed: {
    projectDir() {
      return this.circuitManager.currentProjectDir?.value || ''
    },
    projectName() {
      const dir = this.projectDir
      if (!dir) return this.$t('ui.noFolderOpen')
      return dir.split(/[\\/]/).filter(Boolean).pop() || dir
    },
    circuits() {
      const openIds = new Set((this.circuitManager.openTabs?.value || []).map(t => t.id))
      const list = []
      for (const c of this.circuitManager.allCircuits.value.values()) {
        list.push({
          id: c.id,
          name: c.name,
          isOpen: openIds.has(c.id),
          isDirty: this.hasCircuitUnsavedWork(c.id, this.circuitManager)
        })
      }
      return list.sort((a, b) => a.name.localeCompare(b.name))
    },
    filteredCircuits() {
      const q = this.filter.trim().toLowerCase()
      if (!q) return this.circuits
      return this.circuits.filter(c => c.name.toLowerCase().includes(q))
    }
  },
  methods: {
    toggle() {
      this.menuOpen ? this.close() : this.openMenu()
    },
    openMenu() {
      this.menuOpen = true
      this.filter = ''
      document.addEventListener('mousedown', this.onDocMouseDown)
      document.addEventListener('keydown', this.onDocKeyDown)
      this.$nextTick(() => this.$refs.filter?.focus())
    },
    close() {
      if (!this.menuOpen) return
      this.menuOpen = false
      document.removeEventListener('mousedown', this.onDocMouseDown)
      document.removeEventListener('keydown', this.onDocKeyDown)
    },
    onDocMouseDown(e) {
      if (this.$refs.root && !this.$refs.root.contains(e.target)) this.close()
    },
    onDocKeyDown(e) {
      if (e.key === 'Escape') this.close()
    },
    openCircuit(circuitId) {
      // openTab reopens a closed circuit AND focuses it.
      this.circuitManager.openTab(circuitId)
      this.close()
    }
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.onDocMouseDown)
    document.removeEventListener('keydown', this.onDocKeyDown)
  }
}
</script>

<style scoped>
.all-circuits {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem; /* breathing room from the command-palette icon, ~a tab's worth */
}

.all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px 0 11px;
  border: 1px solid var(--color-border-medium);
  border-radius: 7px;
  background: var(--color-panel-bg);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.all-btn:hover,
.all-btn.is-open {
  background: var(--color-component-hover-fill);
}
.all-btn .chev {
  font-size: 10px;
  color: var(--color-text-muted);
}

.menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1100;
  width: 288px;
  background: var(--color-panel-bg);
  border: 1px solid var(--color-border-medium);
  border-radius: 10px;
  box-shadow: var(--shadow-large);
  overflow: hidden;
}

.menu-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--color-border-light);
}
.menu-head .folder {
  font-size: 13px;
  color: var(--color-brand-primary);
}
.menu-head .head-name {
  font-weight: 650;
  font-size: 12.5px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-head .head-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.menu-search {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 8px 10px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--color-border-light);
  border-radius: 7px;
  background: var(--color-canvas-bg);
}
.menu-search .pi-search {
  font-size: 12px;
  color: var(--color-text-muted);
}
.menu-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 12.5px;
  font-family: inherit;
}

.menu-list {
  max-height: 244px;
  overflow-y: auto;
  padding: 3px 6px 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.row:hover {
  background: var(--color-component-hover-fill);
}
.row.active {
  background: var(--color-component-hover-fill);
  color: var(--color-text-primary);
  font-weight: 600;
}
.row .slot {
  width: 12px;
  flex: none;
  display: grid;
  place-items: center;
}
.g-open {
  width: 11px;
  height: 9px;
  border-radius: 2px 2px 0 0;
  background: var(--color-button-primary);
}
.g-closed {
  width: 11px;
  height: 9px;
  border-radius: 2px 2px 0 0;
  border: 1.4px solid var(--color-border-dark);
  background: transparent;
}
.row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rdot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
  flex: none;
}
.empty {
  padding: 12px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
