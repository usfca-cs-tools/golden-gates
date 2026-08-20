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
  it('unrotated ports: inputs left, outputs right, spread evenly to fill the height', () => {
    const { width, height, inputPoints, outputPoints } = computeSubcircuitLayout(
      [inp(0), inp(0)],
      [inp(0), inp(0)]
    )
    expect(width).toBe(6)
    expect(height).toBe(4)
    // two ports over a height of 4: centered with a 1-unit margin each, filling the edge
    expect(inputPoints).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 3 }
    ])
    expect(outputPoints).toEqual([
      { x: 6, y: 1 },
      { x: 6, y: 3 }
    ])
  })

  it('a lone port on an edge is centered on that edge', () => {
    // adder shape: A,B left; SUM out (right, rot0); COUT out (bottom, rot90).
    const { inputPoints, outputPoints, height, width } = computeSubcircuitLayout(
      [inp(0), inp(0)], // A, B on the left
      [inp(0), inp(90)] // SUM right, COUT bottom
    )
    expect(inputPoints).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 3 }
    ])
    expect(outputPoints[0]).toEqual({ x: width, y: height / 2 }) // SUM: centered on the right edge
    expect(outputPoints[1]).toEqual({ x: width / 2, y: height }) // COUT: centered on the bottom edge
  })

  it('multiple top-edge inputs spread evenly across the width instead of stacking', () => {
    const { width, inputPoints } = computeSubcircuitLayout([inp(90), inp(90), inp(90)], [])
    expect(width).toBe(6)
    // three top ports centered and evenly spaced across the width, on their own grid vertices
    expect(inputPoints).toEqual([
      { x: 1, y: 0 },
      { x: 3, y: 0 },
      { x: 5, y: 0 }
    ])
    const xs = inputPoints.map(p => p.x)
    expect(new Set(xs).size).toBe(3) // all distinct
  })

  it('widens to give rotated top/bottom labels room (LABEL_PITCH apart)', () => {
    expect(computeSubcircuitLayout([inp(90), inp(90)], []).width).toBe(6) // 2 fit in default 6
    // 6 top ports at 2-unit label pitch need width (6-1)*2 + 2 = 12
    expect(computeSubcircuitLayout(Array(6).fill(inp(90)), []).width).toBe(12)
    // and they land 2 grid units apart, not 1
    const { inputPoints } = computeSubcircuitLayout(Array(6).fill(inp(90)), [])
    const gaps = inputPoints.slice(1).map((p, i) => p.x - inputPoints[i].x)
    expect(gaps.every(g => g === 2)).toBe(true)
  })

  it('manual width moves the right-edge outputs', () => {
    const { width, outputPoints } = computeSubcircuitLayout([inp(0)], [inp(0)], { forcedWidth: 10 })
    expect(width).toBe(10)
    expect(outputPoints[0].x).toBe(10)
  })

  it('manual height: every edge spreads to fill the taller frame, centered', () => {
    // adder-1-bit shape: A,B left; SUM right; CIN top; COUT bottom. Raise the height to 6.
    const { height, inputPoints, outputPoints } = computeSubcircuitLayout(
      [inp(0), inp(0), inp(90)], // A, B (left), CIN (top)
      [inp(0), inp(90)], // SUM (right), COUT (bottom)
      { forcedHeight: 6 }
    )
    expect(height).toBe(6) // frame grew
    expect(inputPoints[0]).toEqual({ x: 0, y: 1 }) // A: top of the left edge
    expect(inputPoints[1]).toEqual({ x: 0, y: 5 }) // B: bottom of the left edge — fills the height
    expect(inputPoints[2]).toEqual({ x: 3, y: 0 }) // CIN: centered on the top edge
    expect(outputPoints[0]).toEqual({ x: 6, y: 3 }) // SUM: centered on the taller right edge
    expect(outputPoints[1]).toEqual({ x: 3, y: 6 }) // COUT: centered on the bottom edge, at the new height
  })

  it('a manually-tall frame spreads many ports evenly, centered, on grid vertices', () => {
    // the pipeline-register case: a tall box should distribute its ports over the whole height.
    const { height, inputPoints } = computeSubcircuitLayout(Array(5).fill(inp(0)), [], {
      forcedHeight: 20
    })
    expect(height).toBe(20)
    expect(inputPoints.map(p => p.y)).toEqual([2, 6, 10, 14, 18]) // equal gaps, symmetric margins
    const gaps = inputPoints.slice(1).map((p, i) => p.y - inputPoints[i].y)
    expect(new Set(gaps).size).toBe(1) // perfectly even
    expect(inputPoints.every(p => Number.isInteger(p.y))).toBe(true) // on grid
  })

  it('reserves a band so corner side ports clear the rotated top-edge labels', () => {
    // pipeline register: several control inputs on the top edge (corner ones sit above the first
    // left/right ports) plus data ports on the sides, in a tall manual frame.
    const { inputPoints } = computeSubcircuitLayout(
      [inp(0), inp(0), inp(0), inp(90), inp(90)], // 3 left data inputs + 2 top control inputs
      [],
      { forcedHeight: 20 }
    )
    const topPorts = inputPoints.slice(3) // the two rot90 (top-edge) ports
    const sidePorts = inputPoints.slice(0, 3) // the three left-edge ports
    expect(topPorts.every(p => p.y === 0)).toBe(true) // on the top edge
    // the first left port sits below the reserved 2-unit label band, clearing the corner labels
    expect(sidePorts[0].y).toBeGreaterThanOrEqual(2)
  })

  it('a single centered top/bottom port needs no band (small boxes untouched)', () => {
    // 1-bit adder: A,B left; CIN top (centered); SUM right; COUT bottom (centered).
    const { inputPoints } = computeSubcircuitLayout(
      [inp(0), inp(0), inp(90)],
      [inp(0), inp(90)]
    )
    // no band reserved -> the first left port still starts at the top margin (y=1)
    expect(inputPoints[0].y).toBe(1)
  })

  it('manual height smaller than the port span is clamped up (ports never spill)', () => {
    const { height } = computeSubcircuitLayout([inp(0), inp(0), inp(0), inp(0)], [], {
      forcedHeight: 3
    })
    expect(height).toBe(5) // 4 ports need (4-1)+2 = 5; 3 is ignored
  })
})
