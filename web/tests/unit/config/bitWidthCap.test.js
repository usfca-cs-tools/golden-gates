import { describe, it, expect } from 'vitest'
import { componentPropertySchema as S } from '@/config/componentProperties'

// RV64 support: bit widths must be selectable up to 64 (was 32). The engine is arbitrary-precision,
// so the cap is purely a front-end limit. Guards against a regression back to 32.
const propOf = (comp, name) => S[comp].properties.find(p => p.name === name)

describe('bit-width cap allows 64', () => {
  it('the shared "bits" property (Input/Output/Constant/Register/arithmetic) allows up to 64', () => {
    expect(propOf('input', 'bits').max).toBe(64)
    expect(propOf('output', 'bits').max).toBe(64)
  })

  it('ROM and RAM dataBits allow up to 64', () => {
    expect(propOf('rom', 'dataBits').max).toBe(64)
    expect(propOf('ram', 'dataBits').max).toBe(64)
  })
})
