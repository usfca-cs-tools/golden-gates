import { describe, it, expect } from 'vitest'
import {
  pointOnSegment,
  pointOnPolyline,
  routeOrthogonal,
  stretchWireEndpoint,
  normalizePolyline
} from '@/utils/orthogonalRouting'

// Every segment of an orthogonal polyline must be horizontal or vertical.
const isOrthogonal = pts =>
  pts.slice(0, -1).every((p, i) => p.x === pts[i + 1].x || p.y === pts[i + 1].y)

// Compact literals -> {x,y} arrays
const P = pairs => pairs.map(([x, y]) => ({ x, y }))

describe('stretchWireEndpoint — moving the start (index 0)', () => {
  it('(a) parallel delta just stretches the first segment', () => {
    const out = stretchWireEndpoint(P([[0, 0], [4, 0]]), 0, { x: 2, y: 0 })
    expect(out).toEqual(P([[2, 0], [4, 0]]))
    expect(isOrthogonal(out)).toBe(true)
  })

  it('(b) straight wire moved perpendicular inserts an L, far end fixed', () => {
    const out = stretchWireEndpoint(P([[0, 0], [4, 0]]), 0, { x: 0, y: 2 })
    expect(out).toEqual(P([[0, 2], [4, 2], [4, 0]]))
    expect(isOrthogonal(out)).toBe(true)
    expect(out[out.length - 1]).toEqual({ x: 4, y: 0 }) // far endpoint unchanged
  })

  it('(c) 2-D delta shifts the existing elbow when segment 2 is perpendicular', () => {
    const out = stretchWireEndpoint(P([[0, 0], [4, 0], [4, -3]]), 0, { x: 2, y: 1 })
    expect(out).toEqual(P([[2, 1], [4, 1], [4, -3]]))
    expect(isOrthogonal(out)).toBe(true)
  })

  it('(c-fallback) collinear next segment forces an elbow insertion', () => {
    const out = stretchWireEndpoint(P([[0, 0], [4, 0], [8, 0]]), 0, { x: 0, y: 2 })
    expect(out).toEqual(P([[0, 2], [4, 2], [4, 0], [8, 0]]))
    expect(isOrthogonal(out)).toBe(true)
  })

  it('does not mutate the input array', () => {
    const input = P([[0, 0], [4, 0]])
    const snapshot = JSON.parse(JSON.stringify(input))
    stretchWireEndpoint(input, 0, { x: 0, y: 2 })
    expect(input).toEqual(snapshot)
  })
})

describe('stretchWireEndpoint — moving the end (last index), symmetric', () => {
  it('parallel stretch', () => {
    const out = stretchWireEndpoint(P([[0, 0], [4, 0]]), 1, { x: 2, y: 0 })
    expect(out).toEqual(P([[0, 0], [6, 0]]))
    expect(isOrthogonal(out)).toBe(true)
  })

  it('straight wire perpendicular -> L insertion, far (start) end fixed', () => {
    const out = stretchWireEndpoint(P([[0, 0], [4, 0]]), 1, { x: 0, y: 2 })
    expect(out).toEqual(P([[0, 0], [0, 2], [4, 2]]))
    expect(isOrthogonal(out)).toBe(true)
    expect(out[0]).toEqual({ x: 0, y: 0 })
  })

  it('2-D elbow-shift mirror', () => {
    const out = stretchWireEndpoint(P([[4, -3], [4, 0], [0, 0]]), 2, { x: 2, y: 1 })
    expect(out).toEqual(P([[4, -3], [4, 1], [2, 1]]))
    expect(isOrthogonal(out)).toBe(true)
  })
})

describe('stretchWireEndpoint — degenerate first segment', () => {
  it('coincident first two points resolve orientation by dominant axis', () => {
    // ep == el; a dominant-x delta should treat the first segment as horizontal
    const out = stretchWireEndpoint(P([[2, 2], [2, 2], [2, 5]]), 0, { x: 3, y: 1 })
    expect(isOrthogonal(out)).toBe(true)
  })
})

describe('normalizePolyline', () => {
  it('drops consecutive duplicate points', () => {
    expect(normalizePolyline(P([[0, 0], [0, 0], [4, 0]]))).toEqual(P([[0, 0], [4, 0]]))
  })

  it('merges a collinear run, keeping endpoints', () => {
    expect(normalizePolyline(P([[0, 0], [4, 0], [8, 0]]))).toEqual(P([[0, 0], [8, 0]]))
    expect(normalizePolyline(P([[0, 0], [0, 4], [0, 8]]))).toEqual(P([[0, 0], [0, 8]]))
  })

  it('keeps genuine corners', () => {
    const l = P([[0, 0], [4, 0], [4, 3]])
    expect(normalizePolyline(l)).toEqual(l)
  })

  it('passes through short polylines', () => {
    expect(normalizePolyline(P([[1, 1], [2, 2]]))).toEqual(P([[1, 1], [2, 2]]))
  })
})

describe('routeOrthogonal (parity with prior inline logic)', () => {
  it('horizontal-first inserts a corner then the target', () => {
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 4, y: 3 }, 'horizontal')).toEqual(
      P([[4, 0], [4, 3]])
    )
  })
  it('vertical-first inserts a corner then the target', () => {
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 4, y: 3 }, 'vertical')).toEqual(
      P([[0, 3], [4, 3]])
    )
  })
  it('already aligned appends only the target', () => {
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 4, y: 0 }, 'horizontal')).toEqual(P([[4, 0]]))
  })
  it('same point appends nothing', () => {
    expect(routeOrthogonal({ x: 2, y: 2 }, { x: 2, y: 2 }, 'horizontal')).toEqual([])
  })
})

describe('pointOnSegment / pointOnPolyline', () => {
  it('detects a point on a horizontal segment', () => {
    expect(pointOnSegment({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 })).toBe(true)
    expect(pointOnSegment({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 })).toBe(false)
  })
  it('detects a point anywhere along a polyline', () => {
    const poly = P([[0, 0], [4, 0], [4, 4]])
    expect(pointOnPolyline(poly, { x: 4, y: 2 })).toBe(true)
    expect(pointOnPolyline(poly, { x: 1, y: 1 })).toBe(false)
  })
})
