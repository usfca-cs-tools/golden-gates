<template>
  <div class="python-identifier-input">
    <div class="error-tooltip" v-if="errorMessage">
      {{ errorMessage }}
    </div>
    <!-- 
      NOTE: Unusual readonly approach to prevent macOS autocomplete
      
      macOS Safari/WebKit aggressively shows autocomplete suggestions from Contacts
      even with autocomplete="off". The readonly trick prevents this:
      
      1. Field starts as readonly (prevents autocomplete from showing)
      2. On focus: remove readonly so user can type
      3. On blur: restore readonly to prevent future autocomplete
      
      Additional attributes help prevent autocomplete:
      - autocomplete="nope" (invalid value browsers respect)
      - name="xkslrklrkuutyxu" (random string that won't match patterns)
      - spellcheck now inherited from ComponentInspector parent
    -->
    <input
      type="text"
      :value="modelValue"
      @input="handleInput"
      @blur="handleBlur"
      :class="['p-inputtext', 'p-component', { 'p-filled': modelValue, 'p-invalid': !isValid }]"
      :placeholder="placeholder"
      autocomplete="nope"
      name="xkslrklrkuutyxu"
      role="textbox"
      readonly
      @focus="makeEditable"
    />
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'PythonIdentifierInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Enter name'
    },
    required: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isValid = ref(true)
    const errorMessage = ref('')

    // Circuit name regex: letter or digit, followed by letters, digits, underscores, or hyphens
    const pythonIdentifierRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/

    // Reserved Python keywords
    const pythonKeywords = new Set([
      'False',
      'None',
      'True',
      'and',
      'as',
      'assert',
      'async',
      'await',
      'break',
      'class',
      'continue',
      'def',
      'del',
      'elif',
      'else',
      'except',
      'finally',
      'for',
      'from',
      'global',
      'if',
      'import',
      'in',
      'is',
      'lambda',
      'nonlocal',
      'not',
      'or',
      'pass',
      'raise',
      'return',
      'try',
      'while',
      'with',
      'yield'
    ])

    const validateIdentifier = value => {
      // Allow empty if not required
      if (!value && !props.required) {
        return { valid: true, error: '' }
      }

      // Check if empty but required
      if (!value && props.required) {
        return { valid: false, error: 'Name is required' }
      }

      // Check for invalid characters by finding the first invalid one
      for (let i = 0; i < value.length; i++) {
        const char = value[i]
        const validChar = i === 0 ? /[a-zA-Z0-9_]/.test(char) : /[a-zA-Z0-9_-]/.test(char)

        if (!validChar) {
          return { valid: false, error: `'${char}' is not valid (use letters, digits, - or _)` }
        }
      }

      // Check if it's a reserved keyword
      if (pythonKeywords.has(value)) {
        return { valid: false, error: `'${value}' is a reserved keyword` }
      }

      // Final regex check
      if (!pythonIdentifierRegex.test(value)) {
        return { valid: false, error: 'Invalid identifier' }
      }

      return { valid: true, error: '' }
    }

    const handleInput = event => {
      const newValue = event.target.value

      // Always emit the new value to keep the input responsive
      emit('update:modelValue', newValue)

      // Validate the new value
      const validation = validateIdentifier(newValue)
      isValid.value = validation.valid
      errorMessage.value = validation.error
    }

    const handleBlur = event => {
      // Re-validate on blur to ensure error state is correct
      const validation = validateIdentifier(props.modelValue)
      isValid.value = validation.valid
      errorMessage.value = validation.error

      // IMPORTANT: Re-enable readonly to prevent macOS autocomplete from showing
      // This is part of the readonly trick - see template comment for details
      event.target.readOnly = true
    }

    const makeEditable = event => {
      // IMPORTANT: Remove readonly when user focuses so they can type
      // This is part of the readonly trick - see template comment for details
      event.target.readOnly = false
    }

    // Watch for external changes to modelValue
    watch(
      () => props.modelValue,
      newValue => {
        const validation = validateIdentifier(newValue)
        isValid.value = validation.valid
        errorMessage.value = validation.error
      }
    )

    // Initial validation
    const initialValidation = validateIdentifier(props.modelValue)
    isValid.value = initialValidation.valid
    errorMessage.value = initialValidation.error

    return {
      isValid,
      errorMessage,
      handleInput,
      handleBlur,
      makeEditable
    }
  }
}
</script>

<style scoped>
.python-identifier-input {
  width: 100%;
  position: relative;
}

.error-tooltip {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background-color: var(--p-error-color, #dc3545);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.error-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 1rem;
  border: 4px solid transparent;
  border-top-color: var(--p-error-color, #dc3545);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.python-identifier-input input {
  width: 100%;
}
</style>
