import { describe, it, expect } from 'vitest'
import { getInsertableGroups, getVerbGroups } from '@/config/commands'

describe('getInsertableGroups', () => {
  it('excludes the verb groups (file / simulation)', () => {
    const keys = getInsertableGroups().map(g => g.key)
    expect(keys).not.toContain('file')
    expect(keys).not.toContain('simulation')
  })

  it('includes the seven insertable-element categories with insertable items', () => {
    const groups = getInsertableGroups()
    const staticGroups = groups.filter(g => !g.isCustom)

    expect(staticGroups.map(g => g.key)).toEqual([
      'logicGates',
      'inputOutput',
      'wires',
      'plexers',
      'arithmetic',
      'misc',
      'memory'
    ])

    for (const group of staticGroups) {
      expect(group.items.length).toBeGreaterThan(0)
      // Every static leaf is an insert command; none is a separator or the generic component.
      expect(group.items.every(i => i.action === 'addComponent')).toBe(true)
      expect(group.items.every(i => i.componentType !== 'schematic-component')).toBe(true)
      expect(group.items.some(i => i.separator)).toBe(false)
    }
  })

  it('appends a custom-circuits branch from availableComponents', () => {
    const available = [
      { id: 'circuit_2', name: 'Half Adder' },
      { id: 'circuit_3', name: 'Full Adder' }
    ]
    const groups = getInsertableGroups(available, { projectName: 'lab3' })
    const custom = groups[groups.length - 1]

    expect(custom.isCustom).toBe(true)
    expect(custom.label).toBe('lab3')
    expect(custom.items.map(i => i.label)).toEqual(['Half Adder', 'Full Adder'])
    expect(custom.items.every(i => i.action === 'addCircuitComponent')).toBe(true)
  })

  it('filters the active circuit out of the custom branch (no inserting a circuit into itself)', () => {
    const available = [
      { id: 'circuit_2', name: 'Half Adder' },
      { id: 'circuit_3', name: 'Full Adder' }
    ]
    const groups = getInsertableGroups(available, { activeCircuitId: 'circuit_2' })
    const custom = groups[groups.length - 1]

    expect(custom.items.map(i => i.params[0])).toEqual(['circuit_3'])
  })

  it('leaves the custom branch label null when no project is open', () => {
    const custom = getInsertableGroups().find(g => g.isCustom)
    expect(custom.label).toBeNull()
    expect(custom.items).toEqual([])
  })
})

describe('getVerbGroups', () => {
  it('returns only the file and simulation groups', () => {
    expect(getVerbGroups().map(g => g.key)).toEqual(['file', 'simulation'])
  })
})
