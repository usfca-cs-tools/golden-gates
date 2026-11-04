<template>
  <div class="asm-source-view">
    <div class="asm-header">
      <span class="asm-file-name" :title="source?.name">
        {{ source?.name ?? $t('chipsROM.noProgram') }}
      </span>
      <button class="asm-import-button" :disabled="busy" @click="fileInput?.click()">
        <i class="pi pi-upload"></i>
        {{ $t('chipsROM.importButton') }}
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".s"
        @change="handleFileInput"
        style="display: none"
      />
    </div>

    <p v-if="statusText" class="asm-status">
      <i class="pi pi-spin pi-spinner"></i>
      {{ statusText }}
    </p>

    <div v-if="errors.length" class="asm-errors">
      <p class="asm-error-count">
        <i class="pi pi-exclamation-triangle"></i>
        {{ $t('chipsROM.errorCount', errors.length) }}
      </p>
      <ul>
        <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
      </ul>
    </div>

    <p v-if="overflowMessage" class="asm-warning">
      <i class="pi pi-exclamation-triangle"></i>
      {{ overflowMessage }}
    </p>
    <p v-if="notice" class="asm-warning">{{ notice }}</p>

    <div
      class="asm-drop-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <pre v-if="source" class="asm-source">{{ source.text }}</pre>
      <p v-else class="asm-drop-hint">{{ $t('chipsROM.dropHint') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  sources: {
    type: Array,
    default: () => []
  },
  words: {
    type: Array,
    default: () => []
  },
  addressBits: {
    type: Number,
    default: 6
  },
  status: {
    type: String,
    default: 'idle'
  },
  errors: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['import-file'])
const { t } = useI18n()

const STATUS_KEYS = {
  loading: 'chipsROM.loadingPython',
  assembling: 'chipsROM.assembling'
}

// State
const fileInput = ref(null)
const isDragging = ref(false)
const notice = ref('')

// Computed
// One file per component for now; sources stays an array so saved files don't change.
const source = computed(() => props.sources[0])
const busy = computed(() => props.disabled || props.status !== 'idle')
const statusText = computed(() => {
  const key = STATUS_KEYS[props.status]
  return key ? t(key) : ''
})
// Live: addressBits can be lowered after import. This only warns; words is never changed.
const overflowMessage = computed(() => {
  const capacity = 1 << props.addressBits
  if (props.words.length <= capacity) return ''
  return t('chipsROM.overflow', {
    name: source.value?.name ?? '',
    words: props.words.length,
    addressBits: props.addressBits,
    capacity
  })
})

// Methods
function submit(file) {
  notice.value = ''
  emit('import-file', file)
}

function handleFileInput(event) {
  const file = event.target.files?.[0]
  if (file) {
    submit(file)
  }
  // Clear input for re-selection
  event.target.value = ''
}

function handleDragOver(event) {
  isDragging.value = !busy.value
  event.dataTransfer.dropEffect = busy.value ? 'none' : 'copy'
}

function handleDrop(event) {
  isDragging.value = false
  if (busy.value) return

  const dropped = Array.from(event.dataTransfer.files ?? [])
  const asmFiles = dropped.filter(file => /\.s$/i.test(file.name))
  if (asmFiles.length === 0) {
    if (dropped.length > 0) notice.value = t('chipsROM.asmFilesOnly')
    return
  }

  submit(asmFiles[0])
  if (dropped.length > 1) notice.value = t('chipsROM.oneFileOnly', { name: asmFiles[0].name })
}
</script>

<style scoped>
.asm-source-view {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.asm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.asm-file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--color-text-primary);
}

.asm-import-button {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border-medium);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
}

.asm-import-button:hover:not(:disabled) {
  background-color: var(--color-component-hover-fill);
  color: var(--color-text-primary);
}

.asm-import-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.asm-status,
.asm-warning,
.asm-error-count {
  margin: 0;
  font-size: 0.75rem;
}

.asm-status {
  color: var(--color-text-secondary);
}

.asm-warning {
  color: var(--color-warning);
}

.asm-errors {
  color: var(--color-error);
}

.asm-errors ul {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  font-family: monospace;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.asm-drop-zone {
  min-height: 3rem;
  max-height: 300px;
  overflow: auto;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  background: var(--color-panel-bg);
}

.asm-drop-zone.drag-over {
  border-color: var(--primary-color);
  background: var(--color-component-hover-fill);
}

.asm-source {
  margin: 0;
  padding: 0.5rem;
  white-space: pre;
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--color-text-primary);
}

.asm-drop-hint {
  margin: 0;
  padding: 1rem 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
