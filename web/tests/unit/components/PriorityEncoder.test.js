import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityEncoder from '@/components/PriorityEncoder.vue'
import { GRID_SIZE } from '@/utils/constants'

describe('PriorityEncoder', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(PriorityEncoder, {
      props: {
        id: 'test-priority-encoder',
        x: 2,
        y: 3,
        selectorBits: 2, // 2^2 = 4 inputs
        label: 'PE0'
      }
    })
  })

  describe('Component Structure', () => {
    it('renders priority encoder rectangle', () => {
      const rect = wrapper.find('rect')
      expect(rect.exists()).toBe(true)
      expect(rect.attributes('width')).toBe(String(3 * GRID_SIZE))
      expect(rect.attributes('height')).toBe(String(6 * GRID_SIZE)) // (4-1)*1+2=5, floored at minHeight 6
    })

    it('renders correct number of input connection points', () => {
      const inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(4)

      // Check first and last input positions
      expect(inputs[0].attributes('cx')).toBe('0')
      expect(inputs[0].attributes('cy')).toBe(String(GRID_SIZE)) // First at y=1
      expect(inputs[0].attributes('data-port')).toBe('0')

      expect(inputs[3].attributes('cy')).toBe(String(4 * GRID_SIZE)) // Last at y=4 (1 + 3*1)
      expect(inputs[3].attributes('data-port')).toBe('3')
    })

    it('renders exactly two output connection points (inum and any)', () => {
      const outputs = wrapper.findAll('.connection-point.output')
      expect(outputs).toHaveLength(2)

      // Check output positions
      expect(outputs[0].attributes('cx')).toBe(String(3 * GRID_SIZE))
      expect(outputs[0].attributes('data-port')).toBe('0') // inum

      expect(outputs[1].attributes('cx')).toBe(String(3 * GRID_SIZE))
      expect(outputs[1].attributes('data-port')).toBe('1') // any
    })

    it('renders output labels (inum and any)', () => {
      const texts = wrapper.findAll('text')
      // Should have the component label plus two output labels
      expect(texts.length).toBeGreaterThanOrEqual(3)

      // Find the output labels
      const inumLabel = texts.find(t => t.text() === 'inum')
      const anyLabel = texts.find(t => t.text() === 'any')
      const componentLabel = texts.find(t => t.text() === 'PE0')

      expect(inumLabel.exists()).toBe(true)
      expect(anyLabel.exists()).toBe(true)
      expect(componentLabel.exists()).toBe(true)
    })

    it('renders component label when provided', () => {
      const labels = wrapper.findAll('.component-label')
      expect(labels.length).toBeGreaterThan(0)
      // Find the main component label (should be 'PE0')
      const componentLabel = labels.find(l => l.text() === 'PE0')
      expect(componentLabel.exists()).toBe(true)
    })

    it('does not render main label when empty', async () => {
      await wrapper.setProps({ label: '' })
      const labels = wrapper.findAll('.component-label')
      // Should still have the output labels, but no main component label
      const componentLabel = labels.find(l => l.text() === '')
      expect(componentLabel).toBeUndefined()
    })
  })

  describe('Dynamic Input Count', () => {
    it('renders 2 inputs minimum', async () => {
      await wrapper.setProps({ selectorBits: 1 }) // 2^1 = 2 inputs
      const inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(2)

      // Component should have minimum height (check via outputs spacing)
      expect(inputs[0].attributes('cy')).toBe(String(GRID_SIZE))
      expect(inputs[1].attributes('cy')).toBe(String(2 * GRID_SIZE))
    })

    it('renders up to 16 inputs maximum', async () => {
      await wrapper.setProps({ selectorBits: 4 }) // 2^4 = 16 inputs
      const inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(16)

      // Check that inputs are properly spaced
      expect(inputs[0].attributes('cy')).toBe(String(GRID_SIZE))
      expect(inputs[15].attributes('cy')).toBe(String(16 * GRID_SIZE)) // 1 + 15*1
    })

    it('maintains 1 grid unit spacing between inputs', async () => {
      // Use selectorBits: 2 to get 4 inputs, test first 3
      const inputs = wrapper.findAll('.connection-point.input')

      expect(inputs[0].attributes('cy')).toBe(String(GRID_SIZE))
      expect(inputs[1].attributes('cy')).toBe(String(2 * GRID_SIZE))
      expect(inputs[2].attributes('cy')).toBe(String(3 * GRID_SIZE))
    })
  })

  describe('Grid Alignment', () => {
    it('aligns all connection points to grid vertices', () => {
      const allConnections = wrapper.findAll('.connection-point')

      allConnections.forEach(connection => {
        const cx = parseInt(connection.attributes('cx'))
        const cy = parseInt(connection.attributes('cy'))

        // All positions should be multiples of GRID_SIZE
        expect(cx % GRID_SIZE).toBe(0)
        expect(cy % GRID_SIZE).toBe(0)
      })
    })
  })

  describe('Component Position', () => {
    it('positions priority encoder at correct grid coordinates', () => {
      const container = wrapper.find('g')
      expect(container.attributes('transform')).toBe(
        `translate(${2 * GRID_SIZE}, ${3 * GRID_SIZE})`
      )
    })

    it('updates position when props change', async () => {
      await wrapper.setProps({ x: 5, y: 7 })
      const container = wrapper.find('g')
      expect(container.attributes('transform')).toBe(
        `translate(${5 * GRID_SIZE}, ${7 * GRID_SIZE})`
      )
    })
  })

  describe('Rotation', () => {
    it('applies rotation transform', async () => {
      await wrapper.setProps({ rotation: 90 })
      const rotationGroup = wrapper.findAll('g')[1] // Second g element has rotation
      expect(rotationGroup.attributes('transform')).toContain('rotate(90')
    })

    it('rotates around a grid-aligned center', async () => {
      await wrapper.setProps({ rotation: 180 })
      const rotationGroup = wrapper.findAll('g')[1]
      // x=2 (not the 1.5 body center of a 3-wide body) so rotated ports stay on the grid
      const centerX = 2 * GRID_SIZE
      const centerY = Math.round(6 / 2) * GRID_SIZE // totalHeight=6 → center vertex 3
      expect(rotationGroup.attributes('transform')).toBe(`rotate(180, ${centerX}, ${centerY})`)
    })
  })

  describe('Selection State', () => {
    it('changes visual appearance when selected', async () => {
      await wrapper.setProps({ selected: true })
      const rect = wrapper.find('rect')
      // Selected state is indicated by stroke width, not CSS class
      expect(rect.attributes('stroke-width')).toBe('3')
    })

    it('reverts visual appearance when deselected', async () => {
      await wrapper.setProps({ selected: true })
      await wrapper.setProps({ selected: false })
      const rect = wrapper.find('rect')
      expect(rect.attributes('stroke-width')).toBe('2')
    })
  })

  describe('Interaction', () => {
    it('responds to mousedown events', async () => {
      const rect = wrapper.find('rect')
      expect(rect.element.onmousedown).toBeDefined()
    })

    it('has draggable component setup', () => {
      expect(wrapper.vm.handleMouseDown).toBeDefined()
      expect(typeof wrapper.vm.handleMouseDown).toBe('function')
    })
  })

  describe('Data Attributes', () => {
    it('sets correct data attributes on connection points', () => {
      const inputs = wrapper.findAll('.connection-point.input')
      const outputs = wrapper.findAll('.connection-point.output')

      // Check input data attributes
      inputs.forEach((input, index) => {
        expect(input.attributes('data-component-id')).toBe('test-priority-encoder')
        expect(input.attributes('data-port')).toBe(String(index))
        expect(input.attributes('data-type')).toBe('input')
      })

      // Check output data attributes
      outputs.forEach((output, index) => {
        expect(output.attributes('data-component-id')).toBe('test-priority-encoder')
        expect(output.attributes('data-port')).toBe(String(index))
        expect(output.attributes('data-type')).toBe('output')
      })
    })
  })

  describe('Reactivity', () => {
    it('updates number of inputs when selectorBits changes', async () => {
      // Initially has 2^2 = 4 inputs
      let inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(4)

      // Change to 3 selector bits (2^3 = 8 inputs)
      await wrapper.setProps({ selectorBits: 3 })
      inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(8)

      // Change to 1 selector bit (2^1 = 2 inputs)
      await wrapper.setProps({ selectorBits: 1 })
      inputs = wrapper.findAll('.connection-point.input')
      expect(inputs).toHaveLength(2)

      // Component height should also change
      const rect = wrapper.find('rect')
      expect(rect.attributes('height')).toBe(String(6 * GRID_SIZE)) // Min height for 2 inputs
    })

    it('calculates numInputs computed property correctly', () => {
      expect(wrapper.vm.numInputs).toBe(4) // 2^2 = 4

      // Test the computed property directly
      wrapper.vm.$options.computed.numInputs = wrapper.vm.$options.computed.numInputs.bind({
        selectorBits: 3
      })
      expect(wrapper.vm.$options.computed.numInputs()).toBe(8) // 2^3 = 8
    })
  })
})
