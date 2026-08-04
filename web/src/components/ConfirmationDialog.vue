<template>
  <!-- Custom modal overlay -->
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-dialog" @click.stop>
      <!-- Header with icon and title -->
      <div class="modal-header">
        <i :class="iconClass" class="modal-icon"></i>
        <h3 class="modal-title">{{ title }}</h3>
      </div>

      <!-- Content -->
      <div class="modal-content">
        <p class="modal-message">{{ message }}</p>
      </div>

      <!-- Footer with buttons -->
      <div class="modal-footer">
        <button
          v-if="showCancel"
          ref="cancelButton"
          class="modal-button modal-button-cancel"
          @click="handleReject"
        >
          {{ cancelLabel }}
        </button>
        <button
          class="modal-button modal-button-confirm"
          :class="confirmButtonClass"
          @click="handleAccept"
        >
          {{ acceptLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { nextTick } from 'vue'

export default {
  name: 'ConfirmationDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm Action'
    },
    message: {
      type: String,
      required: true
    },
    acceptLabel: {
      type: String,
      default: 'Yes'
    },
    cancelLabel: {
      type: String,
      default: 'Cancel'
    },
    showCancel: {
      type: Boolean,
      default: true
    },
    type: {
      type: String,
      default: 'warning', // warning, danger, info
      validator: value => ['warning', 'danger', 'info'].includes(value)
    }
  },
  emits: ['accept', 'reject', 'update:visible'],
  computed: {
    iconClass() {
      const icons = {
        warning: 'pi pi-exclamation-triangle',
        danger: 'pi pi-times-circle',
        info: 'pi pi-info-circle'
      }
      return icons[this.type]
    },
    confirmButtonClass() {
      const classes = {
        warning: 'modal-button-warning',
        danger: 'modal-button-danger',
        info: 'modal-button-info'
      }
      return classes[this.type]
    }
  },
  watch: {
    visible(newVal) {
      if (newVal && this.showCancel) {
        // Focus the cancel button (safer option) when dialog opens
        nextTick(() => {
          this.$refs.cancelButton?.focus()
        })
      }
    }
  },
  methods: {
    handleAccept() {
      this.$emit('accept')
      this.handleClose()
    },
    handleReject() {
      this.$emit('reject')
      this.handleClose()
    },
    handleClose() {
      this.$emit('update:visible', false)
    },
    handleOverlayClick() {
      // Don't close on overlay click for confirmation dialogs
      // User must make an explicit choice
    }
  }
}
</script>

<style scoped>
/* Custom modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Modal dialog container. Use the theme surface (light: white, dark: slate #1e293b)
   rather than a hardcoded white — otherwise the themed text goes light-gray-on-white and
   is unreadable in dark mode. The slate surface + border sit distinctly above the darker
   canvas (#0f172a) / app background (#020617), so the dialog still stands out. */
.modal-dialog {
  background: var(--color-modal-bg);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-large);
  width: 100%;
  max-width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Modal header */
.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 2rem 1rem 2rem;
}

.modal-icon {
  font-size: 1.5rem;
  color: var(--color-warning);
  flex-shrink: 0;
}

.modal-icon.pi-times-circle {
  color: var(--color-error);
}

.modal-icon.pi-info-circle {
  color: var(--color-info);
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Modal content */
.modal-content {
  padding: 0 2rem 1.5rem 2rem;
}

.modal-message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

/* Modal footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0 2rem 2rem 2rem;
}

/* Modal buttons */
.modal-button {
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 80px;
  text-align: center;
  font-family: inherit;
}

.modal-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

/* Cancel button */
.modal-button-cancel {
  color: var(--color-text-secondary);
  background-color: transparent;
  border-color: var(--color-border-medium);
}

.modal-button-cancel:hover {
  color: var(--color-text-primary);
  background-color: var(--color-component-hover-fill);
  border-color: var(--color-border-dark);
}

/* Confirm button - default warning style */
.modal-button-confirm {
  color: var(--color-text-inverse);
  background-color: var(--color-warning);
  border-color: var(--color-warning);
}

.modal-button-confirm:hover {
  background-color: var(--color-component-warning-stroke);
  border-color: var(--color-component-warning-stroke);
}

/* Confirm button variants */
.modal-button-danger {
  background-color: var(--color-error);
  border-color: var(--color-error);
}

.modal-button-danger:hover {
  background-color: var(--color-component-error-stroke);
  border-color: var(--color-component-error-stroke);
}

.modal-button-info {
  background-color: var(--color-info);
  border-color: var(--color-info);
}

.modal-button-info:hover {
  background-color: var(--color-button-primary-hover);
  border-color: var(--color-button-primary-hover);
}
</style>
