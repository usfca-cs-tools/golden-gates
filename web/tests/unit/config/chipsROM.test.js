import { describe, it, expect } from 'vitest'
import { componentPropertySchema as S } from '@/config/componentProperties'
import en from '@/locales/en.json'

const propOf = name => S.chipsROM.properties.find(p => p.name === name)

describe('chipsROM config', () => {
  it('shows dataBits fixed at 32 and addressBits from 1 to 16', () => {
    expect(propOf('dataBits')).toMatchObject({ default: 32, disabled: true })
    expect(propOf('addressBits')).toMatchObject({ default: 6, min: 1, max: 16 })
  })

  it('shows words read-only, padded and 32 bits wide', () => {
    expect(propOf('words')).toMatchObject({
      type: 'memory-data-table',
      editable: false,
      dataBits: 32,
      padToAddressSpace: true
    })
  })

  it('has every string it uses in en.json', () => {
    expect(en.commands.insert.chipsROM).toBeTruthy()
    expect(en.componentTypes.chipsROM).toBeTruthy()
    expect(en.chipsROM.noProgram).toBeTruthy()
    expect(en.chipsROM.moreFiles).toContain('{name}')
    expect(en.chipsROM.moreFiles).toContain('{count}')
  })

  it('has the engine error strings with the fields the engine sends', () => {
    const errors = en.simulation.errors
    expect(errors.chipsRomNoProgram).toContain('{label}')
    for (const field of ['{label}', '{words}', '{addressBits}', '{capacity}']) {
      expect(errors.chipsRomOverflow).toContain(field)
    }
  })
})
