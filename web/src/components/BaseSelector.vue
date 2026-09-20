<template>
  <div class="inspector-dropdown">
    <Dropdown
      :modelValue="modelValue"
      :options="options"
      @update:modelValue="handleChange"
      optionLabel="label"
      optionValue="value"
      placeholder="Select base"
      class="base-selector"
    />
  </div>
</template>

<script>
import Dropdown from 'primevue/dropdown'

export default {
  name: 'BaseSelector',
  components: {
    Dropdown
  },
  props: {
    modelValue: {
      type: [Number, String],
      default: 10,
      validator: value => [2, 10, 16, 'ascii'].includes(value)
    },
    // Probe also offers ASCII (Digital-style: the value's low byte shown as a quoted
    // character, e.g. 'A') alongside the numeric bases. Other components using this
    // selector (Input/Output/Constant) leave this off since ASCII isn't a value they can edit.
    includeAscii: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  computed: {
    options() {
      const bases = [
        { label: 'Binary (2)', value: 2 },
        { label: 'Decimal (10)', value: 10 },
        { label: 'Hexadecimal (16)', value: 16 }
      ]
      if (this.includeAscii) {
        bases.push({ label: 'ASCII', value: 'ascii' })
      }
      return bases
    }
  },
  methods: {
    handleChange(value) {
      this.$emit('update:modelValue', value)
    }
  }
}
</script>

<style>
@import '../styles/inspector-dropdown.css';

.base-selector {
  width: 100%;
}
</style>
