<template>
  <div class="truth-table-editor">
    <!-- Structure controls -->
    <div class="toolbar">
      <Button
        label="+ input"
        severity="secondary"
        text
        size="small"
        @click="addInputColumn"
        class="tt-button"
      />
      <Button
        label="+ output"
        severity="secondary"
        text
        size="small"
        @click="addOutputColumn"
        class="tt-button"
      />
      <Button
        label="+ row"
        severity="secondary"
        text
        size="small"
        @click="addRow"
        class="tt-button"
      />
    </div>

    <div class="table-scroll">
      <table class="tt-table">
        <thead>
          <!-- Column-name header row -->
          <tr>
            <th
              v-for="(name, ci) in table.inputNames"
              :key="'in-' + ci"
              class="col-header col-input"
            >
              <div class="col-header-inner">
                <InputText
                  v-model="table.inputNames[ci]"
                  @update:modelValue="emitUpdate"
                  placeholder="in"
                  class="name-input"
                />
                <Button
                  icon="pi pi-minus"
                  severity="danger"
                  text
                  size="small"
                  @click="removeInputColumn(ci)"
                  class="remove-button"
                />
              </div>
            </th>
            <th class="divider-cell" v-if="table.inputNames.length || table.outputNames.length"></th>
            <th
              v-for="(name, ci) in table.outputNames"
              :key="'out-' + ci"
              class="col-header col-output"
            >
              <div class="col-header-inner">
                <InputText
                  v-model="table.outputNames[ci]"
                  @update:modelValue="emitUpdate"
                  placeholder="out"
                  class="name-input"
                />
                <Button
                  icon="pi pi-minus"
                  severity="danger"
                  text
                  size="small"
                  @click="removeOutputColumn(ci)"
                  class="remove-button"
                />
              </div>
            </th>
            <th class="row-action-cell"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in table.rows" :key="'row-' + ri">
            <td v-for="(name, ci) in table.inputNames" :key="'ic-' + ci" class="cell cell-input">
              <MultibaseNumberInput
                :modelValue="row[ci]"
                :base="10"
                @update:both="setCell(row, ci, $event)"
                class="value-input"
              />
            </td>
            <td class="divider-cell" v-if="table.inputNames.length || table.outputNames.length"></td>
            <td v-for="(name, ci) in table.outputNames" :key="'oc-' + ci" class="cell cell-output">
              <MultibaseNumberInput
                :modelValue="row[table.inputNames.length + ci]"
                :base="10"
                @update:both="setCell(row, table.inputNames.length + ci, $event)"
                class="value-input"
              />
            </td>
            <td class="row-action-cell">
              <Button
                icon="pi pi-minus"
                severity="danger"
                text
                size="small"
                @click="removeRow(ri)"
                class="remove-button"
              />
            </td>
          </tr>
          <tr v-if="table.rows.length === 0">
            <td :colspan="totalColumns + 2" class="empty-hint">No rows yet</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import MultibaseNumberInput from './MultibaseNumberInput.vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ inputNames: [], outputNames: [], rows: [] })
  }
})

const emit = defineEmits(['update:modelValue'])

// Normalize an incoming value into a well-formed table
function normalize(v) {
  return {
    inputNames: Array.isArray(v?.inputNames) ? [...v.inputNames] : [],
    outputNames: Array.isArray(v?.outputNames) ? [...v.outputNames] : [],
    rows: Array.isArray(v?.rows) ? v.rows.map(r => [...r]) : []
  }
}

const table = ref(normalize(props.modelValue))

// Watch for external changes
watch(
  () => props.modelValue,
  newValue => {
    table.value = normalize(newValue)
  },
  { deep: true }
)

const totalColumns = computed(
  () => table.value.inputNames.length + table.value.outputNames.length
)

// Column indices: inputs occupy 0..inputNames.length-1,
// outputs occupy inputNames.length + outputIndex.
function addInputColumn() {
  const insertAt = table.value.inputNames.length // append at end of input block
  table.value.inputNames.push('')
  // Insert a 0 cell at the input-block boundary in every row
  table.value.rows.forEach(row => row.splice(insertAt, 0, 0))
  emitUpdate()
}

function removeInputColumn(index) {
  table.value.inputNames.splice(index, 1)
  table.value.rows.forEach(row => row.splice(index, 1))
  emitUpdate()
}

function addOutputColumn() {
  table.value.outputNames.push('')
  // New output column is appended at the very end of each row
  table.value.rows.forEach(row => row.push(0))
  emitUpdate()
}

function removeOutputColumn(index) {
  const cellIndex = table.value.inputNames.length + index
  table.value.outputNames.splice(index, 1)
  table.value.rows.forEach(row => row.splice(cellIndex, 1))
  emitUpdate()
}

function addRow() {
  const width = table.value.inputNames.length + table.value.outputNames.length
  table.value.rows.push(new Array(width).fill(0))
  emitUpdate()
}

function removeRow(index) {
  table.value.rows.splice(index, 1)
  emitUpdate()
}

// Store a cell edited via MultibaseNumberInput. It emits { value } as a decimal string; keep
// it as-is so the widget's own change-tracking (which compares against the string it emitted)
// doesn't wipe the field mid-edit. emitUpdate() coerces cells to Number for the emitted model.
function setCell(row, idx, payload) {
  row[idx] = payload.value
  emitUpdate()
}

function emitUpdate() {
  const width = table.value.inputNames.length + table.value.outputNames.length
  // Always emit rows padded/truncated to the exact total column count
  const rows = table.value.rows.map(row => {
    const r = row.slice(0, width).map(v => Number(v) || 0)
    while (r.length < width) r.push(0)
    return r
  })
  emit('update:modelValue', {
    inputNames: [...table.value.inputNames],
    outputNames: [...table.value.outputNames],
    rows
  })
}
</script>

<style scoped>
.truth-table-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toolbar {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.tt-button {
  color: var(--color-text-secondary) !important;
  padding: 0.125rem 0.375rem !important;
  font-size: 0.7rem !important;
}

.tt-button:hover {
  background-color: var(--color-component-hover-fill) !important;
  color: var(--color-text-primary) !important;
}

.table-scroll {
  overflow-x: auto;
  max-width: 100%;
}

.tt-table {
  border-collapse: collapse;
}

.col-header-inner {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.col-input .name-input :deep(input) {
  background-color: var(--color-component-selected-fill);
}

.name-input {
  width: 56px;
}

.name-input :deep(input) {
  width: 56px;
  font-size: 0.7rem;
  padding: 0.25rem;
}

.value-input {
  width: 48px;
}

.value-input :deep(input) {
  width: 48px;
  font-size: 0.7rem;
  padding: 0.25rem;
  text-align: center;
}

.cell {
  padding: 0.125rem;
}

.divider-cell {
  width: 2px;
  padding: 0;
  background-color: var(--color-border-light);
}

.row-action-cell {
  padding: 0 0.125rem;
}

.empty-hint {
  color: var(--color-text-muted);
  font-size: 0.7rem;
  text-align: center;
  padding: 0.5rem;
}

.remove-button {
  width: 1.5rem !important;
  height: 1.5rem !important;
  background-color: transparent !important;
  border-color: transparent !important;
  color: var(--color-text-secondary) !important;
  padding: 0 !important;
}

.remove-button:hover {
  color: var(--color-error) !important;
}

.remove-button :deep(.p-button-icon) {
  margin: 0 !important;
  font-size: 0.75rem !important;
}

.remove-button :deep(.p-button-label) {
  display: none !important;
}
</style>
