import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SchematicComponent from '@/components/SchematicComponent.vue'
import BaseCircuitComponent from '@/components/BaseCircuitComponent.vue'
import { COLORS } from '@/utils/constants'

// A subcircuit placement the engine reports an error on (e.g. recursiveSubcircuit, a circuit
// placed inside itself) must read red like every other component. SchematicComponent draws its
// body through BaseCircuitComponent, so the error system's hasError/hasWarning props have to be
// forwarded to it.
describe('SchematicComponent error highlight', () => {
  const mountWith = props =>
    mount(SchematicComponent, {
      props: { id: 's', circuitId: 'c1', circuitManager: { getCircuit: () => null }, ...props }
    })

  it('forwards hasError to the body, which fills with the error color', () => {
    const base = mountWith({ hasError: true }).findComponent(BaseCircuitComponent)
    expect(base.props('hasError')).toBe(true)
    expect(base.find(`rect[fill="${COLORS.componentErrorFill}"]`).exists()).toBe(true)
  })

  it('forwards hasWarning to the body', () => {
    const base = mountWith({ hasWarning: true }).findComponent(BaseCircuitComponent)
    expect(base.props('hasWarning')).toBe(true)
  })

  it('has no error fill in the normal state', () => {
    const base = mountWith({}).findComponent(BaseCircuitComponent)
    expect(base.props('hasError')).toBe(false)
    expect(base.find(`rect[fill="${COLORS.componentErrorFill}"]`).exists()).toBe(false)
  })
})
