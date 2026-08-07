<template>
  <div class="bit-range-table">
    <div class="section">
      <div class="section-header">
        <Button
          icon="pi pi-plus"
          severity="secondary"
          text
          size="small"
          @click="addRange"
          class="add-button"
        />
      </div>

      <div class="ranges-list">
        <div v-for="(range, index) in ranges" :key="index" class="range-row">
          <InputNumber
            v-model="range.start"
            :min="0"
            :max="maxBits - 1"
            @update:modelValue="updateRange(index)"
            placeholder="0"
            class="range-input"
          />
          <span class="range-separator">-</span>
          <InputNumber
            v-model="range.end"
            :min="0"
            :max="maxBits - 1"
            @update:modelValue="updateRange(index)"
            placeholder="0"
            class="range-input"
          />
          <Button
            v-if="ranges.length > 1"
            icon="pi pi-minus"
            severity="danger"
            text
            size="small"
            @click="removeRange(index)"
            class="remove-button"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [
      { start: 0, end: 1 },
      { start: 2, end: 3 },
      { start: 4, end: 5 },
      { start: 6, end: 7 }
    ]
  },
  inputBits: {
    type: Number,
    default: 0
  },
  outputBits: {
    type: Number,
    default: 0
  }
})

// Use inputBits for splitter, outputBits for merger. Defaults are 0 (falsy) so the
// width that is actually set wins — otherwise a component without inputBits (the merger)
// would inherit an 8-bit default and clamp its ranges to 7 bits.
const maxBits = computed(() => props.inputBits || props.outputBits || 8)

const emit = defineEmits(['update:modelValue'])

const ranges = ref([...props.modelValue])

// Watch for external changes
watch(
  () => props.modelValue,
  newValue => {
    ranges.value = [...newValue]
  },
  { deep: true }
)

// Watch for bit count changes to clamp ranges
watch(maxBits, newBits => {
  ranges.value.forEach(range => {
    if (range.start >= newBits) range.start = newBits - 1
    if (range.end >= newBits) range.end = newBits - 1
    // Allow any order - no validation constraint
  })
  emitUpdate()
})

function addRange() {
  // Find the next available bit range
  const usedBits = new Set()
  ranges.value.forEach(range => {
    // Handle both forward and reverse ranges
    const minBit = Math.min(range.start, range.end)
    const maxBit = Math.max(range.start, range.end)
    for (let i = minBit; i <= maxBit; i++) {
      usedBits.add(i)
    }
  })

  // Find first unused bit
  let startBit = 0
  for (let i = 0; i < maxBits.value; i++) {
    if (!usedBits.has(i)) {
      startBit = i
      break
    }
  }

  ranges.value.push({ start: startBit, end: startBit })
  emitUpdate()
}

function removeRange(index) {
  if (ranges.value.length > 1) {
    ranges.value.splice(index, 1)
    emitUpdate()
  }
}

function updateRange(index) {
  // Allow any order - no validation constraint
  emitUpdate()
}

function emitUpdate() {
  emit(
    'update:modelValue',
    ranges.value.map(r => ({ ...r }))
  )
}
</script>

<style scoped>
.bit-range-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bits-input {
  width: 100%;
}

.add-button {
  width: 2rem !important;
  height: 2rem !important;
  background-color: transparent !important;
  border-color: transparent !important;
  color: var(--color-text-secondary) !important;
  padding: 0 !important;
}

.add-button:hover {
  background-color: var(--color-component-hover-fill) !important;
  color: var(--color-text-primary) !important;
}

/* Center the icon within PrimeVue button */
.add-button :deep(.p-button-icon) {
  margin: 0 !important;
  font-size: 1rem !important;
}

.add-button :deep(.p-button-label) {
  display: none !important;
}

.ranges-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.range-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-input {
  flex: 1;
  min-width: 60px;
}

.range-separator {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.remove-button {
  width: 2rem !important;
  height: 2rem !important;
  background-color: transparent !important;
  border-color: transparent !important;
  color: var(--color-text-secondary) !important;
  padding: 0 !important;
}

.remove-button:hover {
  background-color: var(--color-component-hover-fill) !important;
  color: var(--color-error) !important;
}

/* Center the icon within PrimeVue button */
.remove-button :deep(.p-button-icon) {
  margin: 0 !important;
  font-size: 1rem !important;
}

.remove-button :deep(.p-button-label) {
  display: none !important;
}
</style>
