import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TunnelComponent from '@/components/TunnelComponent.vue'
import { GRID_SIZE } from '@/utils/constants'

// The tunnel label sits beside the symbol (opposite the connection tip) so a column of tunnels
// reads cleanly: to the right at 0°, to the left at 180°.
const label = rotation =>
  mount(TunnelComponent, { props: { id: 't', x: 0, y: 0, label: 'IW', rotation } }).find(
    '.component-label'
  )

describe('Tunnel label placement', () => {
  it('is to the right of the symbol at 0°', () => {
    const t = label(0)
    expect(t.attributes('text-anchor')).toBe('start')
    expect(Number(t.attributes('x'))).toBeGreaterThan(GRID_SIZE)
    expect(Number(t.attributes('y'))).toBe(GRID_SIZE) // vertically centred on the connection level
  })

  it('is to the left of the symbol at 180°', () => {
    const t = label(180)
    expect(t.attributes('text-anchor')).toBe('end')
    expect(Number(t.attributes('x'))).toBeLessThan(GRID_SIZE)
    expect(Number(t.attributes('y'))).toBe(GRID_SIZE)
  })

  it('is below the wide part at 90° (tip/connection is at the top)', () => {
    const t = label(90)
    expect(t.attributes('text-anchor')).toBe('middle')
    expect(Number(t.attributes('x'))).toBe(GRID_SIZE)
    expect(Number(t.attributes('y'))).toBeGreaterThan(GRID_SIZE) // below the base
  })

  it('is above the wide part at 270° (tip/connection is at the bottom)', () => {
    const t = label(270)
    expect(t.attributes('text-anchor')).toBe('middle')
    expect(Number(t.attributes('x'))).toBe(GRID_SIZE)
    const y = Number(t.attributes('y'))
    expect(y).toBeLessThan(GRID_SIZE) // above the base...
    expect(y).toBeGreaterThan(0) // ...but not up at the old y=-5
  })
})
