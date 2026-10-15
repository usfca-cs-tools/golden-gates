import { describe, it, expect } from 'vitest'
import { getInsertableGroups } from '@/config/commands'

describe('getInsertableGroups', () => {
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

  it('lists every saved circuit, including the one being edited', () => {
    // Recursion (a circuit placed inside itself) is reported by the GGL engine at run time,
    // so the sidebar doesn't hide the active circuit.
    const available = [
      { id: 'circuit_2', name: 'Half Adder' },
      { id: 'circuit_3', name: 'Full Adder' }
    ]
    const custom = getInsertableGroups(available).find(g => g.isCustom)

    expect(custom.items.map(i => i.params[0])).toEqual(['circuit_2', 'circuit_3'])
  })

  it('leaves the custom branch label null when no project is open', () => {
    const custom = getInsertableGroups().find(g => g.isCustom)
    expect(custom.label).toBeNull()
    expect(custom.items).toEqual([])
  })
})
