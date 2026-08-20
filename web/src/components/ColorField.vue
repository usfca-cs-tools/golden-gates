<template>
  <div class="color-field-row">
    <!-- The full picker, unchanged; shows white when nothing is stored yet. -->
    <ColorPicker
      :modelValue="modelValue || 'ffffff'"
      @update:modelValue="emitHex($event)"
      format="hex"
    />
    <!-- Editable hex value: type or paste to copy a color exactly between elements. -->
    <InputText
      class="color-hex"
      :modelValue="hexText"
      @update:modelValue="onHexInput"
      placeholder="#rrggbb"
      spellcheck="false"
      maxlength="7"
    />
  </div>
</template>

<script>
import ColorPicker from 'primevue/colorpicker'
import InputText from 'primevue/inputtext'

export default {
  name: 'ColorField',
  components: { ColorPicker, InputText },
  props: {
    // Bare 6-digit hex without '#', or null for "no color / theme default".
    modelValue: { type: String, default: null }
  },
  emits: ['update:modelValue'],
  computed: {
    hexText() {
      return this.modelValue ? '#' + String(this.modelValue).replace(/^#/, '') : ''
    }
  },
  methods: {
    normalize(v) {
      const h = String(v || '')
        .replace(/^#/, '')
        .trim()
        .toLowerCase()
      return /^[0-9a-f]{6}$/.test(h) ? h : null
    },
    emitHex(v) {
      const h = this.normalize(v)
      if (h) this.$emit('update:modelValue', h)
    },
    onHexInput(v) {
      // Only commit once the text is a full, valid hex — partial typing leaves the value untouched.
      const h = this.normalize(v)
      if (h) this.$emit('update:modelValue', h)
    }
  }
}
</script>

<style scoped>
.color-field-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-hex {
  width: 6.5rem;
  font-family: var(--font-mono, monospace);
  text-transform: lowercase;
}
</style>
