<template>
  <aside class="left-sidebar">
    <div class="sidebar-branches">
      <div v-for="branch in branches" :key="branch.key" class="sidebar-branch">
        <button
          class="sidebar-branch-header"
          @click="toggle(branch.key)"
          :aria-expanded="isExpanded(branch.key)"
        >
          <i
            class="sidebar-chevron"
            :class="isExpanded(branch.key) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
          ></i>
          <span class="sidebar-branch-label">{{ branchLabel(branch) }}</span>
        </button>

        <div v-if="isExpanded(branch.key)" class="sidebar-branch-items">
          <div
            v-for="item in branch.items"
            :key="item.id"
            class="sidebar-item"
            @pointerdown="onPointerDown($event, item)"
            @click="onItemClick(item, branch.isCustom)"
            @dblclick="branch.isCustom ? onOpenCircuit(item) : null"
            :title="branch.isCustom ? $t('sidebar.dragOrClickHint') : $t('sidebar.dragHint')"
          >
            <ComponentIcon
              v-if="item.componentType"
              :componentType="item.componentType"
              :size="16"
              class="sidebar-item-icon"
            />
            <i v-else-if="item.icon" :class="item.icon" class="sidebar-item-icon"></i>
            <span class="sidebar-item-label">{{ itemLabel(item) }}</span>
          </div>

          <div v-if="branch.isCustom && branch.items.length === 0" class="sidebar-empty">
            {{ $t('sidebar.noCircuits') }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import ComponentIcon from './ComponentIcon.vue'
import { getInsertableGroups } from '../config/commands'

// Past this many pixels of pointer movement, a press becomes a drag-to-place rather than a click.
const DRAG_THRESHOLD = 4

export default {
  name: 'Sidebar',
  components: {
    ComponentIcon
  },
  props: {
    availableComponents: {
      type: Array,
      default: () => []
    },
    projectName: {
      type: String,
      default: ''
    },
    activeCircuitId: {
      type: String,
      default: null
    }
  },
  emits: ['insert', 'openCircuit', 'placeStart', 'placeEnd'],
  setup(props, { emit }) {
    const { t } = useI18n()

    // Track collapsed branches by key; absence means expanded (default expanded).
    const collapsed = ref(new Set())

    const branches = computed(() =>
      getInsertableGroups(props.availableComponents, {
        projectName: props.projectName || null,
        activeCircuitId: props.activeCircuitId
      })
    )

    function isExpanded(key) {
      return !collapsed.value.has(key)
    }

    function toggle(key) {
      const next = new Set(collapsed.value)
      next.has(key) ? next.delete(key) : next.add(key)
      collapsed.value = next
    }

    function branchLabel(branch) {
      if (branch.isCustom) {
        return branch.label || t('ui.noFolderOpen')
      }
      return t(branch.labelKey)
    }

    function itemLabel(item) {
      return item.labelKey ? t(item.labelKey) : item.label
    }

    // A double-click delivers two 'click' events plus a 'dblclick'. Static leaves (insert-only)
    // fire immediately; custom leaves defer the insert so a following dblclick (open-to-edit) can
    // cancel it — otherwise a double-click would both insert twice and open.
    let clickTimer = null
    // Set true when a press turns into a drag, so the click that fires on release is swallowed
    // (a drag must not also insert). Reset on the next press.
    let suppressClick = false

    function onItemClick(item, isCustom) {
      if (suppressClick) {
        suppressClick = false
        return
      }
      if (!isCustom) {
        emit('insert', { action: item.action, params: item.params })
        return
      }
      if (clickTimer) return // second click of a double-click; let @dblclick handle it
      clickTimer = setTimeout(() => {
        clickTimer = null
        emit('insert', { action: item.action, params: item.params })
      }, 250)
    }

    function onOpenCircuit(item) {
      if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
      }
      emit('openCircuit', { id: item.params[0] })
    }

    // Drag-to-place via pointer events (NOT native HTML5 DnD, which repaints too slowly during a
    // drag — the preview would lag the cursor). A press that moves past the threshold becomes a
    // drag: App creates a live component that follows the cursor over the canvas. Window listeners
    // keep tracking after the pointer leaves the row and crosses into the canvas.
    let drag = null // { startX, startY, item, dragging } while a press is active

    function onPointerMove(event) {
      if (!drag) return
      if (!drag.dragging) {
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        // Threshold crossed — begin the drag. Pre-empt any pending deferred insert.
        drag.dragging = true
        suppressClick = true
        if (clickTimer) {
          clearTimeout(clickTimer)
          clickTimer = null
        }
        emit('placeStart', { action: drag.item.action, params: drag.item.params })
      }
      emit('placeMove', { clientX: event.clientX, clientY: event.clientY })
    }

    function onPointerUp(event) {
      const wasDragging = drag?.dragging
      teardownDrag()
      if (wasDragging) {
        emit('placeEnd', { clientX: event.clientX, clientY: event.clientY })
      }
    }

    function onPointerCancel() {
      // The gesture was interrupted (e.g. browser/OS took over). Abort any in-flight placement.
      const wasDragging = drag?.dragging
      teardownDrag()
      if (wasDragging) emit('placeEnd', { clientX: -1, clientY: -1 })
    }

    function onKeyDown(event) {
      // Escape cancels an in-flight drag — report a release off-canvas so App cancels it.
      if (event.key === 'Escape' && drag?.dragging) {
        emit('placeEnd', { clientX: -1, clientY: -1 })
        teardownDrag()
      }
    }

    function teardownDrag() {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('keydown', onKeyDown)
      drag = null
    }

    function onPointerDown(event, item) {
      if (event.button !== 0) return // left button only
      teardownDrag() // clear any stuck gesture before starting a new one
      suppressClick = false
      drag = { startX: event.clientX, startY: event.clientY, item, dragging: false }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
      window.addEventListener('keydown', onKeyDown)
    }

    onBeforeUnmount(teardownDrag)

    return {
      branches,
      isExpanded,
      toggle,
      branchLabel,
      itemLabel,
      onItemClick,
      onOpenCircuit,
      onPointerDown
    }
  }
}
</script>

<style scoped>
/* Mirrors .inspector-panel (App.vue) but as a concise left rail: border-right, fixed width. */
.left-sidebar {
  flex-shrink: 0;
  width: 190px;
  display: flex;
  flex-direction: column;
  background-color: var(--color-panel-bg);
  border-right: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-medium);
  overflow: hidden;
  transition: width 0.2s ease;
}

.sidebar-branches {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.sidebar-branch {
  margin-bottom: 0.25rem;
}

/* Header mirrors ComponentInspector's .property-section h4 look. */
.sidebar-branch-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.35rem 0.75rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.sidebar-branch-header:hover {
  color: var(--color-text-primary);
}

.sidebar-chevron {
  flex-shrink: 0;
  font-size: 0.625rem;
}

.sidebar-branch-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Leaf rows mirror .command-item. */
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem 0.35rem 1.4rem;
  cursor: pointer;
  transition: background-color 0.15s;
  /* Don't select the label text while dragging a row onto the canvas. */
  user-select: none;
}

.sidebar-item:hover {
  background-color: var(--color-component-hover-fill);
}

.sidebar-item-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.sidebar-item-label {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-empty {
  padding: 0.35rem 0.75rem 0.35rem 1.4rem;
  font-size: 0.75rem;
  font-style: italic;
  color: var(--color-text-muted);
}
</style>
