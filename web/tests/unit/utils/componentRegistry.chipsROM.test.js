import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { componentRegistry } from '@/utils/componentRegistry'
import { useCircuitModel } from '@/composables/useCircuitModel'
import { useComponentController } from '@/composables/useComponentController'

// chipsROM swaps with ROM by delete-and-place, so its ports must sit exactly where ROM's do (§1).
const chips = componentRegistry.chipsROM
const rom = componentRegistry.rom
const place = (ctrl, y = 0) => ctrl.addComponentAtPosition('chipsROM', { x: 0, y })
const makeController = cm => useComponentController(cm, { snapToGrid: p => p, gridSize: ref(15) })

describe('chipsROM registry entry', () => {
  it('sits in the memory category and asks for the wide inspector', () => {
    expect(chips.category).toBe('memory')
    expect(chips.prefersWideInspector).toBe(true)
    expect(rom.prefersWideInspector).toBeUndefined()
  })

  it.each(Array.from({ length: 16 }, (_, i) => i + 1))(
    'has the same ports and size as rom at addressBits %i',
    addressBits => {
      expect(chips.getConnections({ addressBits })).toEqual(rom.getConnections({ addressBits }))
      expect(chips.getDimensions({ addressBits })).toEqual(rom.getDimensions({ addressBits }))
    }
  )

  it('defaults to 6 address bits', () => {
    expect(chips.defaultProps.addressBits).toBe(6)
  })
})

describe('placing a chipsROM', () => {
  it('starts with 6 address bits and no program', () => {
    const c = place(makeController(useCircuitModel()))
    expect(c.props.addressBits).toBe(6)
    expect(c.props.sources).toEqual([])
    expect(c.props.words).toEqual([])
  })
})
