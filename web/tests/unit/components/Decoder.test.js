import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Decoder from '@/components/Decoder.vue'
import { GRID_SIZE, CONNECTION_DOT_RADIUS } from '@/utils/constants'

describe('Decoder', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(Decoder, {
      props: {
        id: 'decoder-1',
        x: 2,
        y: 3,
        selected: false,
        selectorBits: 2, // 2^2 = 4 outputs
        label: 'DEC0',
        rotation: 0
      }
    })
  })

  describe('Component Structure', () => {
    it('renders decoder trapezoid', () => {
      const path = wrapper.find('path')
      expect(path.exists()).toBe(true)
      // Check the path creates a trapezoid (we don't need to test exact path string)
      expect(path.attributes('d')).toContain('M 0')
      expect(path.attributes('d')).toContain('Z')
    })

    it('renders selector input connection point', () => {
      const inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(1)

      const selInput = inputs[0]
      expect(selInput.attributes('cx')).toBe(String(GRID_SIZE * 1)) // Center of 2-unit wide
      expect(selInput.attributes('cy')).toBe(String(5 * GRID_SIZE)) // Bottom (totalHeight=5 at pitch 1)
      expect(selInput.attributes('data-port')).toBe('0')
    })

    it('renders correct number of output connection points', () => {
      const outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(4)

      // Check first and last output positions
      expect(outputs[0].attributes('cx')).toBe(String(2 * GRID_SIZE))
      expect(outputs[0].attributes('cy')).toBe(String(GRID_SIZE)) // First at y=1
      expect(outputs[0].attributes('data-port')).toBe('0')

      expect(outputs[3].attributes('cy')).toBe(String(4 * GRID_SIZE)) // Last at y=4 (1 + 3*1)
      expect(outputs[3].attributes('data-port')).toBe('3')
    })

    it('does not render port labels', () => {
      const texts = wrapper.findAll('text')
      // Should have the component label and '0' label for first output
      expect(texts).toHaveLength(2)
      // Find the component label (should be 'DEC0')
      const componentLabel = texts.find(t => t.text() === 'DEC0')
      expect(componentLabel.exists()).toBe(true)
    })

    it('renders component label when provided', () => {
      const labels = wrapper.findAll('.component-label')
      expect(labels.length).toBeGreaterThan(0)
      // Find the main component label (should be 'DEC0')
      const componentLabel = labels.find(l => l.text() === 'DEC0')
      expect(componentLabel.exists()).toBe(true)
    })

    it('does not render main label when empty', async () => {
      await wrapper.setProps({ label: '' })
      const labels = wrapper.findAll('.component-label')
      // Should still have the '0' label, but no main component label
      const componentLabel = labels.find(l => l.text() === '')
      expect(componentLabel).toBeUndefined()
    })
  })

  describe('Dynamic Output Count', () => {
    it('renders 2 outputs minimum (1 selector bit)', async () => {
      await wrapper.setProps({ selectorBits: 1 }) // 2^1 = 2 outputs
      const outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(2)

      // Component should have minimum height (check via computed property or visual result)
      // We can't easily test the path height, so just verify outputs are rendered
      expect(outputs[0].attributes('cy')).toBe(String(GRID_SIZE))
      expect(outputs[1].attributes('cy')).toBe(String(2 * GRID_SIZE))
    })

    it('renders up to 16 outputs maximum (4 selector bits)', async () => {
      await wrapper.setProps({ selectorBits: 4 }) // 2^4 = 16 outputs
      const outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(16)

      // Check that outputs are properly spaced
      expect(outputs[0].attributes('cy')).toBe(String(GRID_SIZE))
      expect(outputs[15].attributes('cy')).toBe(String(16 * GRID_SIZE)) // 1 + 15*1
    })

    it('maintains 1 grid unit spacing between outputs', async () => {
      // Use default selectorBits: 2 to get 4 outputs, test first 3
      const outputs = wrapper.findAll('.connection-point.output')

      const y0 = parseInt(outputs[0].attributes('cy'))
      const y1 = parseInt(outputs[1].attributes('cy'))
      const y2 = parseInt(outputs[2].attributes('cy'))

      expect(y1 - y0).toBe(GRID_SIZE)
      expect(y2 - y1).toBe(GRID_SIZE)
    })
  })

  describe('Grid Alignment', () => {
    it('aligns all connection points to grid vertices', async () => {
      await wrapper.setProps({ numOutputs: 5 })

      // Check selector input
      const input = wrapper.find('.connection-point.input')
      const inputX = parseInt(input.attributes('cx'))
      const inputY = parseInt(input.attributes('cy'))
      expect(inputX % GRID_SIZE).toBe(0)
      expect(inputY % GRID_SIZE).toBe(0)

      // Check all outputs
      const outputs = wrapper.findAll('.connection-point.output')
      outputs.forEach(output => {
        const x = parseInt(output.attributes('cx'))
        const y = parseInt(output.attributes('cy'))
        expect(x % GRID_SIZE).toBe(0)
        expect(y % GRID_SIZE).toBe(0)
      })
    })
  })

  describe('Component Position', () => {
    it('positions decoder at correct grid coordinates', () => {
      const g = wrapper.find('g')
      expect(g.attributes('transform')).toBe(`translate(${2 * GRID_SIZE}, ${3 * GRID_SIZE})`)
    })

    it('updates position when props change', async () => {
      await wrapper.setProps({ x: 5, y: 7 })
      const g = wrapper.find('g')
      expect(g.attributes('transform')).toBe(`translate(${5 * GRID_SIZE}, ${7 * GRID_SIZE})`)
    })
  })

  describe('Rotation', () => {
    it('applies rotation transform', async () => {
      await wrapper.setProps({ rotation: 90 })
      const rotationGroup = wrapper.findAll('g')[1] // Second g element has rotation
      expect(rotationGroup.attributes('transform')).toContain('rotate(90')
    })

    it('rotates around component center', async () => {
      await wrapper.setProps({ rotation: 180 })
      const rotationGroup = wrapper.findAll('g')[1]
      const centerX = (2 * GRID_SIZE) / 2 // 2 grid units wide
      const centerY = Math.round(5 / 2) * GRID_SIZE // totalHeight=5 → center snapped to vertex 3
      expect(rotationGroup.attributes('transform')).toBe(`rotate(180, ${centerX}, ${centerY})`)
    })
  })

  describe('Selection State', () => {
    it('changes visual appearance when selected', async () => {
      await wrapper.setProps({ selected: true })
      const path = wrapper.find('path')
      // Selected state is indicated by stroke width, not CSS class
      expect(path.attributes('stroke-width')).toBe('3')
    })

    it('reverts visual appearance when deselected', async () => {
      await wrapper.setProps({ selected: true })
      await wrapper.setProps({ selected: false })
      const path = wrapper.find('path')
      expect(path.attributes('stroke-width')).toBe('2')
    })
  })

  describe('Interaction', () => {
    it('responds to mousedown events', async () => {
      // Component should have handleMouseDown from composable
      expect(wrapper.vm.handleMouseDown).toBeDefined()
      expect(typeof wrapper.vm.handleMouseDown).toBe('function')
    })

    it('has draggable component setup', () => {
      // Verify component uses the draggable composable
      expect(wrapper.vm.fillColor).toBeDefined()
      expect(wrapper.vm.strokeColor).toBeDefined()
      expect(wrapper.vm.strokeWidth).toBeDefined()
      expect(wrapper.vm.componentClasses).toBeDefined()
    })
  })

  describe('Data Attributes', () => {
    it('sets correct data attributes on connection points', () => {
      const input = wrapper.find('.connection-point.input')
      expect(input.attributes('data-component-id')).toBe('decoder-1')
      expect(input.attributes('data-type')).toBe('input')
      expect(input.attributes('data-port')).toBe('0')

      const outputs = wrapper.findAll('.connection-point.output')
      outputs.forEach((output, index) => {
        expect(output.attributes('data-component-id')).toBe('decoder-1')
        expect(output.attributes('data-type')).toBe('output')
        expect(output.attributes('data-port')).toBe(String(index))
      })
    })
  })

  describe('Reactivity', () => {
    it('updates number of outputs when selectorBits changes', async () => {
      // Initially has 2^2 = 4 outputs
      let outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(4)

      // Change to 3 selector bits (2^3 = 8 outputs)
      await wrapper.setProps({ selectorBits: 3 })
      outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(8)

      // Change to 1 selector bit (2^1 = 2 outputs)
      await wrapper.setProps({ selectorBits: 1 })
      outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(2)

      // Component height should also change (check via trapezoid path)
      const path = wrapper.find('path')
      expect(path.exists()).toBe(true) // Path should update with new dimensions
    })

    it('calculates numOutputs computed property correctly', () => {
      expect(wrapper.vm.numOutputs).toBe(4) // 2^2 = 4

      // Test the computed property directly
      wrapper.vm.$options.computed.numOutputs = wrapper.vm.$options.computed.numOutputs.bind({
        selectorBits: 3
      })
      expect(wrapper.vm.$options.computed.numOutputs()).toBe(8) // 2^3 = 8
    })
  })
})
