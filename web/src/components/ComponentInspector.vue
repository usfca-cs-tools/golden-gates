<template>
  <div class="component-inspector" spellcheck="false">
    <div v-if="!component && !circuit" class="empty-state">
      <i class="pi pi-info-circle"></i>
      <p>{{ $t('componentInspector.emptyState') }}</p>
    </div>

    <!-- Circuit properties -->
    <div v-else-if="circuit && !component" class="inspector-content">
      <div class="property-section" v-if="circuitSchema">
        <h4>{{ circuitSchema.title }}</h4>
        <div v-for="prop in visibleCircuitProperties" :key="prop.name" class="property-group">
          <label>{{ prop.label }}</label>

          <!-- Python identifier input for circuit name -->
          <PythonIdentifierInput
            v-if="prop.type === 'text' && prop.name === 'name'"
            :modelValue="getCircuitValue(prop.name)"
            @update:modelValue="updateCircuitValue(prop.name, $event)"
            :placeholder="prop.placeholder"
            :required="true"
            class="property-input"
          />

          <!-- Regular text input for other circuit properties -->
          <InputText
            v-else-if="prop.type === 'text'"
            :modelValue="getCircuitValue(prop.name)"
            @update:modelValue="updateCircuitValue(prop.name, $event)"
            :placeholder="prop.placeholder"
            class="property-input"
          />

          <!-- Textarea for description -->
          <Textarea
            v-else-if="prop.type === 'textarea'"
            :modelValue="getCircuitValue(prop.name)"
            @update:modelValue="updateCircuitValue(prop.name, $event)"
            :placeholder="prop.placeholder"
            :rows="3"
            class="property-input"
          />

          <!-- Body color (per-definition appearance) -->
          <ColorPicker
            v-else-if="prop.type === 'color'"
            :modelValue="getCircuitValue(prop.name, prop.default)"
            @update:modelValue="updateCircuitValue(prop.name, $event)"
            format="hex"
          />

          <!-- Dropdown (e.g. Auto/Manual size mode) -->
          <Dropdown
            v-else-if="prop.type === 'dropdown'"
            :modelValue="getCircuitValue(prop.name, prop.default)"
            :options="prop.options"
            @update:modelValue="updateCircuitValue(prop.name, $event)"
            optionLabel="label"
            optionValue="value"
            class="property-input"
          />

          <!-- Number (manual width/height in grid units) -->
          <InputNumber
            v-else-if="prop.type === 'number'"
            :modelValue="getCircuitValue(prop.name, prop.default)"
            @update:modelValue="updateCircuitValue(prop.name, $event)"
            :min="prop.min || 0"
            :max="prop.max"
            :showButtons="prop.showButtons !== false"
          />

          <small v-if="prop.help" class="property-help">{{ prop.help }}</small>
        </div>

        <!-- Circuit Actions -->
        <div v-if="circuitSchema.actions" class="actions-section">
          <div v-for="action in circuitSchema.actions" :key="action.name" class="action-group">
            <Button
              :label="action.label"
              :title="action.help"
              class="p-button-sm action-button"
              @click="handleAction(action.name)"
            />
            <small v-if="action.help" class="property-help">{{ action.help }}</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Component properties -->
    <div v-else-if="component" class="inspector-content">
      <!-- Component properties based on configuration -->
      <div class="property-section" v-if="componentSchema">
        <h4>{{ componentSchema.title }}</h4>
        <div
          v-for="prop in componentSchema.properties.filter(p => !p.hidden)"
          :key="prop.name"
          class="property-group"
        >
          <label>{{ prop.label }}</label>

          <!-- Text input -->
          <InputText
            v-if="prop.type === 'text'"
            :modelValue="getPropValue(prop.name, prop.default)"
            @update:modelValue="updateProp(prop.name, $event)"
          />

          <!-- Textarea (multi-line text, e.g. text annotations) -->
          <Textarea
            v-else-if="prop.type === 'textarea'"
            :modelValue="getPropValue(prop.name, prop.default)"
            @update:modelValue="updateProp(prop.name, $event)"
            :placeholder="prop.placeholder"
            :rows="3"
            class="property-input"
          />

          <!-- Color picker (e.g. LED color) -->
          <ColorPicker
            v-else-if="prop.type === 'color'"
            :modelValue="getPropValue(prop.name, prop.default)"
            @update:modelValue="updateProp(prop.name, $event)"
            format="hex"
          />

          <!-- Number input -->
          <MultibaseNumberInput
            v-else-if="
              prop.type === 'number' &&
              (component.type === 'input' || component.type === 'constant') &&
              prop.name === 'value'
            "
            :modelValue="getPropValue(prop.name, prop.default)"
            :base="getPropValue('base', 10)"
            @update:both="updateMultipleProps($event)"
            :min="prop.min || 0"
            :max="getMaxValue(prop)"
          />
          <InputNumber
            v-else-if="prop.type === 'number'"
            :modelValue="getPropValue(prop.name, prop.default)"
            @update:modelValue="updateProp(prop.name, $event)"
            :min="prop.min || 0"
            :max="getMaxValue(prop)"
            :showButtons="prop.showButtons !== false"
          />

          <!-- Base selector -->
          <BaseSelector
            v-else-if="prop.type === 'base-selector'"
            :modelValue="getPropValue(prop.name, prop.default)"
            @update:modelValue="updateProp(prop.name, $event)"
          />

          <!-- Rotation selector -->
          <RotationSelector
            v-else-if="prop.type === 'rotation-selector'"
            :modelValue="getPropValue(prop.name, prop.default)"
            @update:modelValue="updateProp(prop.name, $event)"
          />

          <!-- Inverted inputs selector -->
          <InvertedInputsSelector
            v-else-if="prop.type === 'inverted-inputs-selector'"
            :modelValue="getPropValue(prop.name, prop.default)"
            :numInputs="getPropValue('numInputs', 2)"
            @update:modelValue="updateProp(prop.name, $event)"
          />

          <!-- Bit range table for splitter (inputBits) and merger (outputBits) -->
          <BitRangeTable
            v-else-if="prop.type === 'bit-range-table'"
            :modelValue="getPropValue(prop.name, prop.default)"
            :inputBits="getPropValue('inputBits', 0)"
            :outputBits="getPropValue('outputBits', 0)"
            @update:modelValue="updateProp(prop.name, $event)"
          />

          <!-- Generic dropdown -->
          <Dropdown
            v-else-if="prop.type === 'dropdown'"
            :modelValue="getPropValue(prop.name, prop.default)"
            :options="prop.options"
            @update:modelValue="updateProp(prop.name, $event)"
            optionLabel="label"
            optionValue="value"
            class="property-input"
          />

          <!-- Boolean checkbox (binary mode) -->
          <Checkbox
            v-else-if="prop.type === 'boolean'"
            :modelValue="getPropValue(prop.name, false)"
            :binary="true"
            @update:modelValue="updateProp(prop.name, $event)"
          />

          <!-- Truth table editor for Test components -->
          <TruthTableEditor
            v-else-if="prop.type === 'truth-table'"
            :modelValue="getPropValue('table', { inputNames: [], outputNames: [], rows: [] })"
            @update:modelValue="updateProp('table', $event)"
          />

          <!-- Memory data table for ROM/RAM -->
          <MemoryDataTable
            v-else-if="prop.type === 'memory-data-table'"
            :modelValue="getPropValue(prop.name, [])"
            :addressBits="getPropValue('addressBits', 4)"
            :dataBits="getPropValue('dataBits', 8)"
            :editable="prop.editable !== false"
            @update:modelValue="updateProp(prop.name, $event)"
          />
        </div>
      </div>

      <!-- Fallback for unknown component types -->
      <div v-else class="property-section">
        <h4>{{ getComponentTitle(component.type) }}</h4>
        <p class="no-properties">No properties available</p>
      </div>
    </div>

    <!-- Focus-return hint (issue #132): subtle, dismissible cue that Esc (or a canvas
         click) hands keyboard focus back to the circuit so R/T etc. work again. -->
    <div v-if="(component || circuit) && !focusHintDismissed" class="focus-hint">
      <span>Press <kbd>Esc</kbd> or click the canvas to return to the circuit</span>
      <button class="focus-hint-dismiss" @click="dismissFocusHint">Don't show again</button>
    </div>
  </div>
</template>

<script>
import { getComponentProperties, getCircuitProperties } from '../config/componentProperties'
import MultibaseNumberInput from './MultibaseNumberInput.vue'
import BaseSelector from './BaseSelector.vue'
import RotationSelector from './RotationSelector.vue'
import InvertedInputsSelector from './InvertedInputsSelector.vue'
import BitRangeTable from './BitRangeTable.vue'
import TruthTableEditor from './TruthTableEditor.vue'
import PythonIdentifierInput from './PythonIdentifierInput.vue'
import MemoryDataTable from './MemoryDataTable.vue'
import Textarea from 'primevue/textarea'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import ColorPicker from 'primevue/colorpicker'

export default {
  name: 'ComponentInspector',
  components: {
    MultibaseNumberInput,
    BaseSelector,
    RotationSelector,
    InvertedInputsSelector,
    BitRangeTable,
    TruthTableEditor,
    PythonIdentifierInput,
    MemoryDataTable,
    Textarea,
    Dropdown,
    Checkbox,
    ColorPicker
  },
  props: {
    component: {
      type: Object,
      default: null
    },
    circuit: {
      type: Object,
      default: null
    },
    gridSize: {
      type: Number,
      default: 30
    }
  },
  emits: ['update:component', 'update:circuit', 'action'],
  data() {
    // Focus-return hint dismissal (issue #132), remembered via localStorage — following the
    // app's direct-localStorage convention (cf. useKeyboardShortcuts 'recentCommands').
    // Guarded so a blocked/absent store (private mode, tests) just shows the hint.
    let focusHintDismissed = false
    try {
      focusHintDismissed = localStorage.getItem('gg.inspectorFocusHintDismissed') === '1'
    } catch (e) {
      focusHintDismissed = false
    }
    return { focusHintDismissed }
  },
  computed: {
    componentSchema() {
      return this.component ? getComponentProperties(this.component.type) : null
    },
    circuitSchema() {
      return this.circuit ? getCircuitProperties() : null
    },
    // Circuit fields to render: drop statically-hidden ones and any whose `hiddenWhen(properties)`
    // predicate is true right now (e.g. width/height only show under Manual size mode).
    visibleCircuitProperties() {
      const props = this.circuit?.properties || {}
      return (this.circuitSchema?.properties || []).filter(
        p => !p.hidden && !(typeof p.hiddenWhen === 'function' && p.hiddenWhen(props))
      )
    }
  },
  methods: {
    dismissFocusHint() {
      this.focusHintDismissed = true
      try {
        localStorage.setItem('gg.inspectorFocusHintDismissed', '1')
      } catch (e) {
        // localStorage may be unavailable (e.g. private mode); the in-memory flag still hides it.
      }
    },
    getPropValue(propName, defaultValue) {
      const value = this.component?.props?.[propName]
      // Return the actual value if it exists (including empty string)
      // Only use default if value is null or undefined
      return value !== null && value !== undefined ? value : defaultValue
    },

    getMaxValue(prop) {
      if (prop.maxFormula && this.component) {
        return prop.maxFormula(this.component.props || {})
      }
      return prop.max || 999999
    },

    getComponentTitle(type) {
      const schema = getComponentProperties(type)
      return schema?.title || 'Component'
    },

    updatePosition(axis, value) {
      if (value === null || value === undefined || !this.component) return

      this.$emit('update:component', {
        ...this.component,
        [axis]: value
      })
    },

    updateProp(propName, value) {
      if (!this.component) return

      this.$emit('update:component', {
        ...this.component,
        props: {
          ...this.component.props,
          [propName]: value
        }
      })
    },

    updateMultipleProps(updates) {
      if (!this.component) return

      this.$emit('update:component', {
        ...this.component,
        props: {
          ...this.component.props,
          ...updates
        }
      })
    },

    // Circuit value methods
    getCircuitValue(propName, defaultValue = '') {
      if (propName === 'name') return this.circuit?.name || ''
      if (propName === 'label') return this.circuit?.label || ''
      // Return the stored value as-is (numbers, null color) — don't `|| ''`-coerce, which would
      // string-break a numeric width/height and hide a legitimately-falsy value.
      const value = this.circuit?.properties?.[propName]
      return value !== null && value !== undefined ? value : defaultValue
    },

    updateCircuitValue(propName, value) {
      if (!this.circuit) return

      const updatedCircuit = {
        ...this.circuit,
        [propName]: value,
        properties: {
          ...this.circuit.properties,
          [propName]: value
        }
      }

      this.$emit('update:circuit', updatedCircuit)
    },

    // Handle action button clicks
    handleAction(actionName) {
      this.$emit('action', {
        action: actionName,
        circuit: this.circuit,
        component: this.component
      })
    }
  }
}
</script>

<style scoped>
.component-inspector {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Focus-return hint (issue #132): quiet, theme-aware, dismissible. */
.focus-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--color-border-light);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.focus-hint kbd {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
  font-size: 0.7rem;
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--color-border-medium);
  border-radius: 3px;
  background: var(--color-component-hover-fill);
  color: var(--color-text-secondary);
}

.focus-hint-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-decoration: underline;
  cursor: pointer;
}

.focus-hint-dismiss:hover {
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 150px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 1.5rem;
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  color: var(--color-text-muted);
}

.empty-state p {
  margin: 0;
  font-size: 0.75rem;
}

.inspector-content {
  padding: 1rem;
}

.no-properties {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  text-align: center;
  margin: 1rem 0;
}

.property-section {
  margin-bottom: 1.5rem;
}

.property-section:first-child {
  margin-top: 0;
}

.property-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-component-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.property-group {
  margin-bottom: 0.75rem;
}

.actions-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-light);
}

.action-group {
  margin-bottom: 0.75rem;
}

.action-button {
  width: 100%;
  margin-bottom: 0.25rem;
}

.property-group label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-component-text);
}

.property-help {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.625rem;
  color: var(--color-text-muted);
  font-style: normal;
}

.position-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.375rem;
}

/* Override PrimeVue input styles for compact layout */
.component-inspector :deep(.p-inputtext),
.component-inspector :deep(.p-inputnumber-input),
.component-inspector :deep(.p-dropdown) {
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
  height: 32px;
}

/* Fix InputNumber width to match other inputs */
.component-inspector :deep(.p-inputnumber) {
  width: 100%;
  display: flex;
  max-width: 100%;
}

/* Ensure InputNumber input field doesn't overflow */
.component-inspector :deep(.p-inputnumber .p-inputnumber-input) {
  width: 100%;
  flex: 1;
}

/* Fix MultibaseNumberInput width */
.component-inspector :deep(.multibase-number-input) {
  width: 100%;
  max-width: 100%;
}

.component-inspector :deep(.multibase-number-input input) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.component-inspector :deep(.p-dropdown-label) {
  padding: 0;
  font-size: 0.75rem;
}

.component-inspector :deep(.p-dropdown-trigger) {
  width: 1.75rem;
}

.component-inspector :deep(.p-dropdown-trigger-icon) {
  font-size: 0.625rem;
}

.component-inspector :deep(.p-inputnumber-button) {
  width: 1.75rem;
}

.component-inspector :deep(.p-inputnumber-button .pi) {
  font-size: 0.625rem;
}

/* Style dropdowns to match other inputs */
.component-inspector :deep(.p-dropdown) {
  font-size: 0.75rem;
  height: 32px;
  width: 100%;
  display: flex;
  align-items: center;
}

.component-inspector :deep(.p-dropdown .p-dropdown-label) {
  padding: 0 0.625rem;
  font-size: 0.75rem;
  line-height: 30px;
}

.component-inspector :deep(.p-dropdown .p-dropdown-trigger) {
  width: 1.75rem;
}

.component-inspector :deep(.p-dropdown-trigger-icon) {
  font-size: 0.625rem;
}

.component-inspector :deep(.p-dropdown-panel .p-dropdown-item) {
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
}

/* Ensure property groups contain their children properly */
.property-group > * {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* Style the custom inspector dropdown to match */
.component-inspector :deep(.inspector-dropdown) {
  width: 100%;
}

/* Override PrimeVue dropdown panel styles for consistency */
.component-inspector :deep(.p-dropdown-panel) {
  font-size: 0.75rem;
}

.component-inspector :deep(.p-dropdown-items .p-dropdown-item) {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
}
</style>
