import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CommandPalette from '@/components/CommandPalette.vue'

// Mock vue-i18n
const mockT = vi.fn(key => key)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

// Mock ComponentIcon
vi.mock('@/components/ComponentIcon.vue', () => ({
  default: {
    name: 'ComponentIcon',
    props: ['componentType', 'size'],
    template: '<div class="component-icon-mock">{{ componentType }}</div>'
  }
}))

describe('CommandPalette', () => {
  let wrapper

  const createWrapper = (props = {}) => {
    return mount(CommandPalette, {
      props: {
        modelValue: false,
        ...props
      },
      global: {
        mocks: {
          $t: mockT
        },
        stubs: {
          Dialog: {
            template: '<div class="dialog-mock" v-if="visible"><slot /></div>',
            props: ['visible', 'modal', 'closable', 'showHeader', 'dismissableMask', 'pt'],
            emits: ['hide']
          },
          ComponentIcon: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Visibility', () => {
    it('should not be visible when modelValue is false', () => {
      wrapper = createWrapper({ modelValue: false })
      expect(wrapper.find('.command-palette').exists()).toBe(false)
    })

    it('should be visible when modelValue is true', () => {
      wrapper = createWrapper({ modelValue: true })
      expect(wrapper.find('.command-palette').exists()).toBe(true)
    })

    it('should emit update:modelValue when hiding', async () => {
      wrapper = createWrapper({ modelValue: true })
      wrapper.vm.visible = false
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })
  })

  describe('Contents', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('has no search input (type-ahead removed)', () => {
      expect(wrapper.find('.command-palette-input').exists()).toBe(false)
    })

    it('renders only the verb groups (file + simulation), not insertable elements', () => {
      const keys = wrapper.vm.groups.map(g => g.key)
      expect(keys).toEqual(['file', 'simulation'])
      // No insertable-element group leaks into the palette.
      expect(keys).not.toContain('logicGates')
      expect(keys).not.toContain('customCircuits')
    })

    it('includes an "Again" item in the simulation group', () => {
      const sim = wrapper.vm.groups.find(g => g.key === 'simulation')
      const again = sim.items.find(i => i.id === 'again')
      expect(again).toBeDefined()
      expect(again.action).toBe('again')
    })

    it('drops separator items from rendered groups', () => {
      const allItems = wrapper.vm.groups.flatMap(g => g.items)
      expect(allItems.every(i => !i.separator)).toBe(true)
    })

    it('renders group headers', () => {
      const groupHeaders = wrapper.findAll('.command-group-header')
      expect(groupHeaders.length).toBe(2)
    })
  })

  describe('Command execution', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('emits a command event when executing a verb', async () => {
      await wrapper.vm.executeCommand({
        id: 'run-simulation',
        action: 'runSimulation',
        params: []
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('command')).toBeTruthy()
      expect(wrapper.emitted('command')[0]).toEqual([{ action: 'runSimulation', params: [] }])
    })

    it('emits {action:"again"} when executing the Again item', async () => {
      const sim = wrapper.vm.groups.find(g => g.key === 'simulation')
      const again = sim.items.find(i => i.id === 'again')

      await wrapper.vm.executeCommand(again)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('command')[0]).toEqual([{ action: 'again', params: [] }])
    })

    it('hides the palette after executing a command', async () => {
      await wrapper.vm.executeCommand({ id: 'x', action: 'runSimulation' })

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })
  })

  describe('Keyboard navigation', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('moves selection with arrow down', async () => {
      const results = wrapper.find('.command-palette-results')
      const initialIndex = wrapper.vm.selectedIndex

      await results.trigger('keydown', { key: 'ArrowDown' })

      expect(wrapper.vm.selectedIndex).toBe(initialIndex + 1)
    })

    it('moves selection with arrow up (wrapping)', async () => {
      wrapper.vm.selectedIndex = 2
      const results = wrapper.find('.command-palette-results')

      await results.trigger('keydown', { key: 'ArrowUp' })

      expect(wrapper.vm.selectedIndex).toBe(1)
    })

    it('closes the palette on Escape', async () => {
      const results = wrapper.find('.command-palette-results')
      await results.trigger('keydown', { key: 'Escape' })

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('executes the selected command on Enter', async () => {
      wrapper.vm.selectedIndex = 0
      const event = { key: 'Enter', preventDefault: vi.fn() }
      wrapper.vm.handleKeyDown(event)
      await wrapper.vm.$nextTick()

      expect(event.preventDefault).toHaveBeenCalled()
      expect(wrapper.emitted('command')).toBeTruthy()
    })
  })
})
