<template>
  <div class="memory-data-table">
    <div class="table-header">
      <div class="header-controls">
        <BaseSelector
          v-model="displayBase"
          @update:modelValue="handleBaseChange"
          class="base-selector"
        />
        <button
          v-if="editable"
          @click="triggerFileInput"
          v-tooltip.top="$t('memory.importData')"
          class="import-button"
        >
          <i class="pi pi-upload"></i>
        </button>
        <button
          v-if="editable"
          @click="clearData"
          v-tooltip.top="'Clear Data'"
          class="clear-button"
        >
          <i class="pi pi-trash"></i>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".hex,.text,.txt,.mem,.dat,.json"
          @change="handleFileInput"
          style="display: none"
        />
      </div>
    </div>

    <div
      class="table-container"
      @dragover.prevent="handleDragOver"
      @drop.prevent="handleDrop"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      :class="{ 'drag-over': isDragging }"
    >
      <table class="memory-table">
        <tbody>
          <tr v-for="row in numRows" :key="row">
            <td v-for="col in columns" :key="col" class="memory-cell" :style="{ minWidth: cellMinWidth }">
              <div class="cell-address">
                {{ formatAddress((row - 1) * columns + (col - 1)) }}
              </div>
              <input
                :value="formatData(getDataAt((row - 1) * columns + (col - 1)))"
                @input="updateDataAt((row - 1) * columns + (col - 1), $event.target.value)"
                @focus="handleCellFocus((row - 1) * columns + (col - 1))"
                @blur="handleCellBlur"
                class="cell-input"
                :class="{
                  active: activeCellIndex === (row - 1) * columns + (col - 1),
                  readonly: !editable
                }"
                :readonly="!editable"
                spellcheck="false"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isDragging" class="drag-overlay">
      <i class="pi pi-upload"></i>
      <p>{{ $t('memory.dropFileHere') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import BaseSelector from './BaseSelector.vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  addressBits: {
    type: Number,
    default: 4,
    validator: value => value >= 1 && value <= 16
  },
  dataBits: {
    type: Number,
    default: 8,
    validator: value => value >= 1 && value <= 64
  },
  highlightAddress: {
    type: Number,
    default: -1
  },
  editable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

// State
const displayBase = ref(16) // Default to hex
const isDragging = ref(false)
const activeCellIndex = ref(-1)
const fileInput = ref(null)

// Computed
const totalCells = computed(() => Math.pow(2, props.addressBits))
// Columns per row: fewer for wider data so a full cell (e.g. 16 hex digits for 64-bit) isn't
// clipped and the table stays a reasonable width.
const columns = computed(() => {
  const hexDigits = Math.ceil(props.dataBits / 4)
  return hexDigits <= 8 ? 8 : hexDigits <= 16 ? 4 : 2
})
const numRows = computed(() => Math.ceil(totalCells.value / columns.value))
// Cell width scaled to the data width so all hex digits are visible (monospace), never below the
// original 5rem floor.
const cellMinWidth = computed(() => `${Math.max(5, Math.ceil(props.dataBits / 4) * 0.7 + 1)}rem`)
// Exact max cell value (2^dataBits - 1) as BigInt, so 64-bit data isn't rounded past 2**53.
const maxDataValue = computed(() => 2n ** BigInt(props.dataBits) - 1n)

// Initialize data array if empty
const data = ref([...props.modelValue])
if (data.value.length === 0) {
  data.value = new Array(totalCells.value).fill(0)
  emit('update:modelValue', data.value)
}

// Watch for external changes
watch(
  () => props.modelValue,
  newValue => {
    data.value = [...newValue]
  },
  { deep: true }
)

// Watch for addressBits changes to resize array
watch(
  () => props.addressBits,
  newBits => {
    const newSize = Math.pow(2, newBits)
    if (data.value.length < newSize) {
      // Expand array
      data.value = [...data.value, ...new Array(newSize - data.value.length).fill(0)]
    } else if (data.value.length > newSize) {
      // Truncate array
      data.value = data.value.slice(0, newSize)
    }
    emit('update:modelValue', data.value)
  }
)

// Methods
function getDataAt(index) {
  return index < data.value.length ? data.value[index] : 0
}

function updateDataAt(index, valueStr) {
  if (index >= totalCells.value || !props.editable) return

  // Parse value in the current base with BigInt (parseInt/Number would round 64-bit cells past
  // 2**53 and corrupt the value sent to the engine).
  let value = 0n
  valueStr = valueStr.trim()
  if (valueStr !== '') {
    try {
      if (displayBase.value === 2) value = BigInt('0b' + valueStr.replace(/^0[bB]/, ''))
      else if (displayBase.value === 16) value = BigInt('0x' + valueStr.replace(/^0[xX]/, ''))
      else value = BigInt(valueStr)
    } catch {
      value = 0n
    }
  }

  // Clamp to [0, maxDataValue]
  if (value < 0n) value = 0n
  else if (value > maxDataValue.value) value = maxDataValue.value

  // Store as an exact decimal string (JSON-safe; view.py int() reads it exactly).
  const newData = [...data.value]
  newData[index] = value.toString()
  data.value = newData
  emit('update:modelValue', newData)
}

function formatAddress(index) {
  if (index >= totalCells.value) return ''

  const hexAddr = index.toString(16).toUpperCase()
  const padding = Math.ceil(props.addressBits / 4)
  return hexAddr.padStart(padding, '0')
}

function formatData(value) {
  // Cells are decimal strings (or legacy Numbers); parse with BigInt so 64-bit data displays exactly.
  let v
  try {
    v = BigInt(value ?? 0)
  } catch {
    v = 0n
  }
  if (displayBase.value === 2) {
    return v.toString(2).padStart(props.dataBits, '0')
  } else if (displayBase.value === 16) {
    const hexDigits = Math.ceil(props.dataBits / 4)
    return v.toString(16).toUpperCase().padStart(hexDigits, '0')
  } else {
    return v.toString(10)
  }
}

function handleBaseChange(newBase) {
  displayBase.value = newBase
}

function handleCellFocus(index) {
  activeCellIndex.value = index
}

function handleCellBlur() {
  activeCellIndex.value = -1
}

// File import handling
function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileInput(event) {
  const file = event.target.files?.[0]
  if (file) {
    importFile(file)
  }
  // Clear input for re-selection
  event.target.value = ''
}

function handleDragOver(event) {
  event.dataTransfer.dropEffect = 'copy'
}

function handleDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer.files?.[0]
  if (file) {
    importFile(file)
  }
}

function clearData() {
  const newData = new Array(totalCells.value).fill(0)
  data.value = newData
  emit('update:modelValue', newData)
}

async function importFile(file) {
  try {
    const text = await file.text()
    const values = parseMemoryFile(text)

    // Truncate or pad to match total cells
    const newData = new Array(totalCells.value).fill(0)
    for (let i = 0; i < Math.min(values.length, totalCells.value); i++) {
      newData[i] = Math.max(0, Math.min(values[i], maxDataValue.value))
    }

    data.value = newData
    emit('update:modelValue', newData)
  } catch (error) {
    console.error('Error importing memory file:', error)
    // TODO: Show user-friendly error message
  }
}

// Dispatch by content: a JSON array/object goes to the JSON parser; anything else is treated
// as a hex memory image — a plain list of hex words, or the Logisim/Digital "v2.0 raw" format
// (header skipped, bare tokens read as hex, `count*value` run-length expanded). This is what
// the toolchain's .hex/.text dumps look like.
function parseMemoryFile(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJsonFile(text)
  }

  const values = []
  for (let token of trimmed.split(/\s+/)) {
    if (!token) continue
    // "v2.0 raw" header tokens
    if (/^v[\d.]+$/i.test(token) || token.toLowerCase() === 'raw') continue

    // Run-length encoding: count*value (count decimal, value hex)
    let count = 1
    const rle = token.match(/^(\d+)\*(.+)$/)
    if (rle) {
      count = parseInt(rle[1], 10)
      token = rle[2]
    }

    let value
    try {
      if (/^0x/i.test(token)) value = BigInt(token)
      else if (/^0b/i.test(token)) value = BigInt(token)
      else value = BigInt('0x' + token) // bare token = hex, per the v2.0 raw convention
    } catch {
      continue
    }
    // Store exact decimal strings so 64-bit cells survive (parseInt rounds past 2**53).
    for (let i = 0; i < count; i++) values.push(value.toString())
  }

  return values
}

function parseJsonFile(text) {
  const jsonData = JSON.parse(text)

  // Support both direct arrays and objects with a "data" property
  const array = Array.isArray(jsonData) ? jsonData : jsonData.data

  if (!Array.isArray(array)) {
    throw new Error('JSON must contain an array of values')
  }

  const values = []

  for (const item of array) {
    // BigInt keeps 64-bit values exact; store decimal strings. (A JSON *number* above 2**53 was
    // already rounded by JSON.parse — use string values in the file for exact large data.)
    let value
    try {
      if (typeof item === 'number') {
        value = BigInt(Math.trunc(item))
      } else if (typeof item === 'string') {
        if (/^0[xXbB]/.test(item)) value = BigInt(item)
        else if (/^[0-9a-fA-F]+$/.test(item))
          value = BigInt('0x' + item) // bare hex digits
        else value = BigInt(item) // decimal
      } else {
        value = BigInt(Math.trunc(Number(item)))
      }
    } catch {
      continue
    }
    values.push(value.toString())
  }

  return values
}
</script>

<style scoped>
.memory-data-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.base-selector {
  width: 120px;
}

.import-button,
.clear-button {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  max-width: 36px;
  max-height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.import-button:hover,
.clear-button:hover {
  background-color: var(--color-component-hover-fill);
  color: var(--color-text-primary);
}

.table-container {
  position: relative;
  max-height: 300px;
  /* Horizontal scroll too, so wide data (e.g. 64-bit binary) doesn't clip. */
  overflow: auto;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  background: var(--color-panel-bg);
}

.table-container.drag-over {
  border-color: var(--primary-color);
  background: var(--color-component-hover-fill);
}

.memory-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.memory-cell {
  padding: 0.125rem;
  border: 1px solid var(--color-border-medium);
  position: relative;
  min-width: 5rem; /* Ensure space for 8 hex characters (FFFFFFFF) */
  background: var(--color-component-fill);
  min-height: 3rem;
}

.cell-address {
  position: absolute;
  top: 0.125rem;
  left: 0.25rem;
  font-size: 0.625rem;
  color: var(--color-text-secondary);
  font-family: monospace;
  font-weight: 600;
  opacity: 0.8;
}

.cell-input {
  width: 100%;
  padding: 0.25rem;
  padding-top: 1rem;
  border: none;
  background: transparent;
  font-family: monospace;
  font-size: 0.875rem;
  text-align: center;
  outline: none;
  color: var(--color-text-primary);
  font-weight: 500;
}

.cell-input:focus {
  background: var(--color-component-hover-fill);
  outline: 1px solid var(--color-component-selected-stroke);
}

.cell-input.active {
  background: var(--color-component-selected-fill);
  color: var(--color-text-primary);
}

.cell-input.readonly {
  background: transparent;
  color: var(--color-text-secondary);
  cursor: default;
  opacity: 0.9;
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border: 2px dashed var(--primary-color);
  border-radius: 6px;
  pointer-events: none;
}

.drag-overlay i {
  font-size: 2rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.drag-overlay p {
  color: var(--primary-color);
  font-weight: 600;
}

/* Scrollbar styling */
.table-container::-webkit-scrollbar {
  width: 8px;
  height: 8px; /* Make horizontal scrollbar same width as vertical */
}

.table-container::-webkit-scrollbar-track {
  background: var(--color-border-light);
}

.table-container::-webkit-scrollbar-thumb {
  background: var(--color-border-medium);
  border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-dark);
}
</style>
