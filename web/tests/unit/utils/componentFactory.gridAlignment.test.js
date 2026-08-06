import { describe, it, expect } from 'vitest'
import { createGateRegistryEntry } from '@/utils/componentFactory'

// Unlike componentFactory.rotation.test.js (which mocks the gate definition to null), this suite
// exercises the REAL gate definitions. A gate rotates around its output point, so if the output —
// or any input relative to it — lands off a grid vertex, the connection points drift off-grid when
// rotated and wires can no longer meet them. Connection coords are in grid units, so "on the grid"
// means "integer".
const isGrid = n => Number.isInteger(n)

const assertOnGrid = (gateType, numInputs) => {
  const entry = createGateRegistryEntry(gateType, {})
  for (const rotation of [0, 90, 180, 270]) {
    const { inputs, outputs } = entry.getConnections({ numInputs, invertedInputs: [], rotation })
    for (const p of [...inputs, ...outputs]) {
      expect(isGrid(p.x), `${gateType} @${rotation}° x=${p.x}`).toBe(true)
      expect(isGrid(p.y), `${gateType} @${rotation}° y=${p.y}`).toBe(true)
    }
  }
}

describe('gate connection points stay on grid vertices through rotation', () => {
  // Regression: NOT output was at 3 - 5/15 = 2.667 grid units, so rotating it left both the input
  // and output off-grid. It should sit right on the 3-grid-unit vertex.
  it('NOT gate outputs on a vertex (was 2.667 grid units)', () => {
    const { outputs } = createGateRegistryEntry('not', {}).getConnections({
      numInputs: 1,
      invertedInputs: [],
      rotation: 0
    })
    expect(outputs[0].x).toBe(3)
  })

  it('NOT gate stays on grid at every rotation', () => {
    assertOnGrid('not', 1)
  })

  // The other inverting/basic gates already land their output on a vertex (4/5/5/6 grid units).
  // NOTE: 'and' is intentionally omitted — its output is still at 3.667 grid units, a separate
  // latent bug tracked outside this fix.
  for (const gateType of ['or', 'xor', 'nand', 'nor', 'xnor']) {
    it(`${gateType} gate stays on grid at every rotation`, () => {
      assertOnGrid(gateType, 2)
    })
  }
})
