import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { componentRegistry } from '@/utils/componentRegistry'
import { GRID_SIZE, CHIPS_ROM_MIN_WIDTH, chipsRomWidth } from '@/utils/constants'
import { useCircuitModel } from '@/composables/useCircuitModel'
import { useComponentController } from '@/composables/useComponentController'

// chipsROM keeps ROM's A/sel offsets and height; its body is wider so the filename fits, which moves D right (§10.13).
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
    'keeps rom port offsets and height, with a wider body, at addressBits %i',
    addressBits => {
      const width = chipsRomWidth(addressBits)
      const romConn = rom.getConnections({ addressBits })
      const conn = chips.getConnections({ addressBits })
      expect(conn.inputs).toEqual(romConn.inputs)
      expect(conn.outputs).toEqual([{ ...romConn.outputs[0], x: width }])
      expect(chips.getDimensions({ addressBits })).toEqual({
        ...rom.getDimensions({ addressBits }),
        width: width * GRID_SIZE
      })
    }
  )

  it('is wide enough for the longest course program name', () => {
    expect(chipsRomWidth(6)).toBe(CHIPS_ROM_MIN_WIDTH)
    expect(Math.floor((CHIPS_ROM_MIN_WIDTH * GRID_SIZE - 8) / 5.5)).toBeGreaterThanOrEqual(
      'get_bitseq_signed_s.s'.length
    )
  })

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
