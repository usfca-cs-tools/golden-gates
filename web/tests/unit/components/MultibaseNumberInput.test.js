import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MultibaseNumberInput from '@/components/MultibaseNumberInput.vue'

describe('MultibaseNumberInput', () => {
  const createWrapper = (props = {}) => {
    return mount(MultibaseNumberInput, {
      props: {
        modelValue: 0,
        base: 10,
        min: 0,
        max: 255,
        placeholder: '0, 0x0, 0b0',
        ...props
      }
    })
  }

  describe('Props', () => {
    it('should accept modelValue prop', () => {
      const wrapper = createWrapper({ modelValue: 42 })
      expect(wrapper.props('modelValue')).toBe(42)
    })

    it('should accept base prop', () => {
      const wrapper = createWrapper({ base: 16 })
      expect(wrapper.props('base')).toBe(16)
    })

    it('should accept min and max props', () => {
      const wrapper = createWrapper({ min: 10, max: 100 })
      expect(wrapper.props('min')).toBe(10)
      expect(wrapper.props('max')).toBe(100)
    })

    it('should accept placeholder prop', () => {
      const wrapper = createWrapper({ placeholder: 'Enter value' })
      expect(wrapper.props('placeholder')).toBe('Enter value')
    })

    it('should validate base prop correctly', () => {
      const validator = MultibaseNumberInput.props.base.validator
      expect(validator(2)).toBe(true)
      expect(validator(10)).toBe(true)
      expect(validator(16)).toBe(true)
      expect(validator(8)).toBe(false)
      expect(validator(12)).toBe(false)
    })
  })

  describe('Display formatting', () => {
    it('should display decimal values correctly', () => {
      const wrapper = createWrapper({ modelValue: 42, base: 10 })
      const input = wrapper.find('input')
      expect(input.element.value).toBe('42')
    })

    it('should display hexadecimal values correctly', () => {
      const wrapper = createWrapper({ modelValue: 255, base: 16 })
      const input = wrapper.find('input')
      expect(input.element.value).toBe('0xff')
    })

    it('should display binary values correctly', () => {
      const wrapper = createWrapper({ modelValue: 5, base: 2 })
      const input = wrapper.find('input')
      expect(input.element.value).toBe('0b00000101')
    })

    it('should display zero values correctly in all bases', () => {
      let wrapper = createWrapper({ modelValue: 0, base: 10 })
      expect(wrapper.find('input').element.value).toBe('0')

      wrapper = createWrapper({ modelValue: 0, base: 16 })
      expect(wrapper.find('input').element.value).toBe('0x00')

      wrapper = createWrapper({ modelValue: 0, base: 2 })
      expect(wrapper.find('input').element.value).toBe('0b00000000')
    })
  })

  describe('Input validation', () => {
    it('should accept valid decimal input', async () => {
      const wrapper = createWrapper({ base: 10 })
      const input = wrapper.find('input')

      await input.setValue('123')

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '123', base: 10 })
    })

    it('should accept valid hexadecimal input', async () => {
      const wrapper = createWrapper({ base: 16 })
      const input = wrapper.find('input')

      await input.setValue('0xff')

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '255', base: 16 })
    })

    it('keeps the typed text when the emitted value is stored back as a Number', async () => {
      // The truth-table editor coerces cells to Number, so our emitted decimal string "255"
      // comes back as modelValue 255. That round-trip must NOT be treated as an external
      // change (which would wipe what the user typed). See sameNum() in the component.
      const wrapper = createWrapper({ base: 10, max: 65535 })
      const input = wrapper.find('input')

      await input.setValue('0xff') // user types hex; component emits { value: '255' }
      await wrapper.setProps({ modelValue: 255 }) // caller stores it back as a Number

      expect(input.element.value).toBe('0xff') // still shows what was typed, not '255'
    })

    it('should accept valid binary input', async () => {
      const wrapper = createWrapper({ base: 2 })
      const input = wrapper.find('input')

      await input.setValue('0b101')

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '5', base: 2 })
    })

    it('should handle uppercase prefixes', async () => {
      const wrapper = createWrapper({ base: 16 })
      const input = wrapper.find('input')

      await input.setValue('0XFF')

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '255', base: 16 })
    })

    it('parses a 64-bit value exactly (BigInt, not rounded like parseInt)', async () => {
      const wrapper = createWrapper({ base: 16, max: Math.pow(2, 64) - 1 })
      const input = wrapper.find('input')

      await input.setValue('0x0100000000000000') // 2**56

      // parseInt would stringify the double as 72057594037927940 (off by 4) and corrupt the value
      // sent to the engine; BigInt keeps it exact.
      expect(wrapper.emitted('update:both')[0][0]).toEqual({
        value: '72057594037927936',
        base: 16
      })
    })

    it('should reject invalid characters for decimal', async () => {
      const wrapper = createWrapper({ base: 10 })
      const input = wrapper.find('input')

      await input.setValue('12a')

      expect(wrapper.find('.error-tooltip').exists()).toBe(true)
      expect(wrapper.find('.error-tooltip').text()).toContain('not valid for base 10')
    })

    it('should reject invalid characters for hexadecimal', async () => {
      const wrapper = createWrapper({ base: 16 })
      const input = wrapper.find('input')

      await input.setValue('0xgg')

      expect(wrapper.find('.error-tooltip').exists()).toBe(true)
      expect(wrapper.find('.error-tooltip').text()).toContain('not valid for base 16')
    })

    it('should reject invalid characters for binary', async () => {
      const wrapper = createWrapper({ base: 2 })
      const input = wrapper.find('input')

      await input.setValue('0b102')

      expect(wrapper.find('.error-tooltip').exists()).toBe(true)
      expect(wrapper.find('.error-tooltip').text()).toContain('not valid for base 2')
    })
  })

  describe('Range validation', () => {
    it('should show overflow error when value exceeds max', async () => {
      const wrapper = createWrapper({ max: 7 }) // 3 bits max
      const input = wrapper.find('input')

      await input.setValue('8')

      expect(wrapper.find('.error-tooltip').exists()).toBe(true)
      expect(wrapper.find('.error-tooltip').text()).toContain('Overflows 3 bits')
    })

    it('should not emit when value is out of range', async () => {
      const wrapper = createWrapper({ min: 10, max: 100 })
      const input = wrapper.find('input')

      await input.setValue('5') // Below min

      expect(wrapper.emitted('update:both')).toBeFalsy()
    })

    it('should accept values within range', async () => {
      const wrapper = createWrapper({ min: 10, max: 100 })
      const input = wrapper.find('input')

      await input.setValue('50')

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '50', base: 10 })
    })
  })

  describe('Base detection', () => {
    it('should detect decimal base from input', async () => {
      const wrapper = createWrapper({ base: 16 }) // Start with hex
      const input = wrapper.find('input')

      await input.setValue('123') // No prefix = decimal

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '123', base: 10 })
    })

    it('should detect hexadecimal base from input', async () => {
      const wrapper = createWrapper({ base: 10 }) // Start with decimal
      const input = wrapper.find('input')

      await input.setValue('0xff') // Hex prefix

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '255', base: 16 })
    })

    it('should detect binary base from input', async () => {
      const wrapper = createWrapper({ base: 10 }) // Start with decimal
      const input = wrapper.find('input')

      await input.setValue('0b101') // Binary prefix

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '5', base: 2 })
    })
  })

  describe('Partial input handling', () => {
    it('should allow partial prefixes', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      await input.setValue('0x')

      expect(wrapper.find('.error-tooltip').exists()).toBe(false)
      expect(wrapper.emitted('update:both')).toBeFalsy()
    })

    it('should allow partial binary prefix', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      await input.setValue('0b')

      expect(wrapper.find('.error-tooltip').exists()).toBe(false)
      expect(wrapper.emitted('update:both')).toBeFalsy()
    })

    it('should clear partial prefixes on blur', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      await input.setValue('0x')
      await input.trigger('blur')

      // Component formats the value using the current modelValue (0) and base (10)
      expect(input.element.value).toBe('0')
    })
  })

  describe('Events', () => {
    it('should emit update:both when value and base change', async () => {
      const wrapper = createWrapper({ base: 10 })
      const input = wrapper.find('input')

      await input.setValue('0xff')

      expect(wrapper.emitted('update:both')).toBeTruthy()
      expect(wrapper.emitted('update:both')[0][0]).toEqual({ value: '255', base: 16 })
    })

    it('should not emit when input is invalid', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      await input.setValue('invalid')

      expect(wrapper.emitted('update:both')).toBeFalsy()
    })
  })

  describe('CSS classes', () => {
    it('should have correct base CSS classes', () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      expect(input.classes()).toContain('p-inputtext')
      expect(input.classes()).toContain('p-component')
    })

    it('should have p-filled class when there is a value', () => {
      const wrapper = createWrapper({ modelValue: 42 })
      const input = wrapper.find('input')

      expect(input.classes()).toContain('p-filled')
    })

    it('should have p-invalid class when there is an error', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      await input.setValue('invalid')

      expect(input.classes()).toContain('p-invalid')
    })
  })

  describe('Accessibility', () => {
    it('should have correct placeholder text', () => {
      const wrapper = createWrapper({ placeholder: 'Enter a number' })
      const input = wrapper.find('input')

      expect(input.attributes('placeholder')).toBe('Enter a number')
    })

    it('should have correct input type', () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')

      expect(input.attributes('type')).toBe('text')
    })
  })

  describe('Value changes from parent', () => {
    it('should update display when modelValue changes', async () => {
      const wrapper = createWrapper({ modelValue: 42, base: 10 })

      await wrapper.setProps({ modelValue: 100 })

      const input = wrapper.find('input')
      expect(input.element.value).toBe('100')
    })

    it('should update display when base changes', async () => {
      const wrapper = createWrapper({ modelValue: 255, base: 10 })

      await wrapper.setProps({ base: 16 })

      const input = wrapper.find('input')
      expect(input.element.value).toBe('0xff')
    })
  })
})
