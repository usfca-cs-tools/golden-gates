import { describe, it, expect } from 'vitest'
import { computeSubcircuitLayout, portEdge } from '@/utils/subcircuitPorts'

const inp = rotation => ({ rotation })

describe('portEdge', () => {
  it('maps role + rotation to the box edge the port lands on', () => {
    expect(portEdge(true, 0)).toBe('left')
    expect(portEdge(true, 90)).toBe('top')
    expect(portEdge(true, 270)).toBe('bottom')
    expect(portEdge(false, 0)).toBe('right')
    expect(portEdge(false, 90)).toBe('bottom')
    expect(portEdge(false, 270)).toBe('top')
  })
})

describe('computeSubcircuitLayout', () => {
  it('unrotated ports: inputs on the left, outputs on the right, spread top-to-bottom', () => {
    const { width, height, inputPoints, outputPoints } = computeSubcircuitLayout(
      [inp(0), inp(0)],
      [inp(0), inp(0)]
    )
    expect(width).toBe(6)
    expect(height).toBe(4)
    expect(inputPoints).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 }
    ])
    expect(outputPoints).toEqual([
      { x: 6, y: 1 },
      { x: 6, y: 2 }
    ])
  })

  it('a lone port on an edge is centered (regression guard: adder SUM/COUT must not move)', () => {
    // adder-8-bit shape: SUM out (right, rot0) + COUT out (bottom, rot90). SUM must stay centered
    // on the right edge exactly where 1.5/1.6 files already wired it.
    const { inputPoints, outputPoints, height, width } = computeSubcircuitLayout(
      [inp(0), inp(0)], // A, B on the left
      [inp(0), inp(90)] // SUM right, COUT bottom
    )
    expect(inputPoints).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 }
    ])
    expect(outputPoints[0]).toEqual({ x: width, y: 1 }) // SUM: right edge, role index 0
    expect(outputPoints[1]).toEqual({ x: width / 2, y: height }) // COUT: alone on bottom -> centered
  })

  it('the bug fix: multiple top-edge inputs spread left-to-right instead of stacking', () => {
    const { inputPoints } = computeSubcircuitLayout([inp(90), inp(90), inp(90)], [])
    // three top ports on their own grid vertices, not all at one dot
    expect(inputPoints).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 }
    ])
    const xs = inputPoints.map(p => p.x)
    expect(new Set(xs).size).toBe(3) // all distinct
  })

  it('widens only when a horizontal edge needs more than the default room', () => {
    expect(computeSubcircuitLayout([inp(90), inp(90)], []).width).toBe(6) // 2 fit in default 6
    // 6 top ports need width 7
    expect(computeSubcircuitLayout(Array(6).fill(inp(90)), []).width).toBe(7)
  })

  it('manual width moves the right-edge outputs', () => {
    const { width, outputPoints } = computeSubcircuitLayout([inp(0)], [inp(0)], { forcedWidth: 10 })
    expect(width).toBe(10)
    expect(outputPoints[0].x).toBe(10)
  })

  it('manual height: the bottom-edge port tracks the new height, side ports stay put', () => {
    // adder-1-bit shape: A,B left; SUM right; CIN top; COUT bottom. Raise the height to 6.
    const { height, inputPoints, outputPoints } = computeSubcircuitLayout(
      [inp(0), inp(0), inp(90)], // A, B (left), CIN (top)
      [inp(0), inp(90)], // SUM (right), COUT (bottom)
      { forcedHeight: 6 }
    )
    expect(height).toBe(6) // frame grew
    expect(inputPoints[0]).toEqual({ x: 0, y: 1 }) // A: unchanged
    expect(inputPoints[1]).toEqual({ x: 0, y: 2 }) // B: unchanged
    expect(inputPoints[2]).toEqual({ x: 3, y: 0 }) // CIN: top edge, unchanged
    expect(outputPoints[0]).toEqual({ x: 6, y: 1 }) // SUM: right edge, role-index anchored — stays put
    expect(outputPoints[1]).toEqual({ x: 3, y: 6 }) // COUT: bottom edge — tracks the new height
  })

  it('manual height smaller than the port span is clamped up (ports never spill)', () => {
    const { height } = computeSubcircuitLayout([inp(0), inp(0), inp(0), inp(0)], [], {
      forcedHeight: 3
    })
    expect(height).toBe(5) // 4 ports need (4-1)+2 = 5; 3 is ignored
  })
})
