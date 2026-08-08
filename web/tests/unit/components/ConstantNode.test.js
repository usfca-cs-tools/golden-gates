import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConstantNode from '@/components/ConstantNode.vue'

describe('ConstantNode', () => {
  describe('value formatting', () => {
    it('should format decimal values correctly', () => {
      const wrapper = mount(ConstantNode, {
        props: {
          id: 'const1',
          x: 0,
          y: 0,
          value: 42,
          base: 10,
          bits: 8
        }
      })

      expect(wrapper.vm.formattedValue).toBe('42')
    })

    it('should format hexadecimal values correctly', () => {
      const wrapper = mount(ConstantNode, {
        props: {
          id: 'const1',
          x: 0,
          y: 0,
          value: 255,
          base: 16,
          bits: 8
        }
      })

      expect(wrapper.vm.formattedValue).toBe('0xFF')
    })

    it('should format binary values correctly', () => {
      const wrapper = mount(ConstantNode, {
        props: {
          id: 'const1',
          x: 0,
          y: 0,
          value: 5,
          base: 2,
          bits: 4
        }
      })

      expect(wrapper.vm.formattedValue).toBe('0b0101')
    })

    it('should handle null values gracefully', () => {
      const wrapper = mount(ConstantNode, {
        props: {
          id: 'const1',
          x: 0,
          y: 0,
          value: null,
          base: 10,
          bits: 8
        }
      })

      expect(wrapper.vm.formattedValue).toBe('0')
    })
  })

  describe('visual representation', () => {
    it('renders the value with no surrounding box, draggable via an invisible hitbox', () => {
      const wrapper = mount(ConstantNode, {
        props: {
          id: 'const1',
          x: 0,
          y: 0,
          value: 42
        }
      })

      // No visible shape: the only rect is the transparent drag hitbox (no rounded corners).
      const rects = wrapper.findAll('rect')
      expect(rects.length).toBe(1)
      expect(rects[0].classes()).toContain('constant-hitbox')
      expect(rects[0].attributes('fill')).toBe('transparent')
      expect(rects[0].attributes('rx')).toBeUndefined()
      // The value is drawn as plain text next to the connection point.
      expect(wrapper.find('text.component-value').text()).toBe('42')
    })

    it('should have a single output connection point', () => {
      const wrapper = mount(ConstantNode, {
        props: {
          id: 'const1',
          x: 0,
          y: 0
        }
      })

      const outputConnections = wrapper.findAll('[data-type="output"]')
      expect(outputConnections.length).toBe(1)
    })
  })
})
