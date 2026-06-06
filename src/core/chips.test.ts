import { describe, it, expect } from 'vitest'
import { breakdown } from './chips'

describe('breakdown', () => {
  it('returns empty array for zero amount', () => {
    expect(breakdown(0)).toEqual([])
  })

  it('handles a single denomination exactly', () => {
    expect(breakdown(100)).toEqual([{ denomination: 100, count: 1 }])
  })

  it('uses greedy highest-first strategy', () => {
    expect(breakdown(1000)).toEqual([{ denomination: 1000, count: 1 }])
  })

  it('combines multiple of the same denomination', () => {
    expect(breakdown(200)).toEqual([{ denomination: 100, count: 2 }])
  })

  it('mixes denominations greedily — $1575', () => {
    // 1×$1000 + 1×$500 + 3×$25
    expect(breakdown(1575)).toEqual([
      { denomination: 1000, count: 1 },
      { denomination: 500, count: 1 },
      { denomination: 25, count: 3 },
    ])
  })

  it('handles amounts requiring $1 chips', () => {
    // $7 → 1×$5 + 2×$1
    expect(breakdown(7)).toEqual([
      { denomination: 5, count: 1 },
      { denomination: 1, count: 2 },
    ])
  })

  it('handles a complex amount — $136', () => {
    // 1×$100 + 1×$25 + 2×$5 + 1×$1
    expect(breakdown(136)).toEqual([
      { denomination: 100, count: 1 },
      { denomination: 25, count: 1 },
      { denomination: 5, count: 2 },
      { denomination: 1, count: 1 },
    ])
  })

  it('skips denominations with count 0', () => {
    const result = breakdown(5)
    expect(result.every((c) => c.count > 0)).toBe(true)
    expect(result).toEqual([{ denomination: 5, count: 1 }])
  })

  it('respects custom denominations', () => {
    // Custom: [10, 5, 2, 1]
    expect(breakdown(17, [10, 5, 2, 1])).toEqual([
      { denomination: 10, count: 1 },
      { denomination: 5, count: 1 },
      { denomination: 2, count: 1 },
    ])
  })

  it('uses default denominations when none provided', () => {
    const result = breakdown(25)
    expect(result).toEqual([{ denomination: 25, count: 1 }])
  })

  it('handles large amounts', () => {
    // $3000 → 3×$1000
    expect(breakdown(3000)).toEqual([{ denomination: 1000, count: 3 }])
  })

  it('handles amount that needs all denominations', () => {
    // $1631 → 1×$1000 + 1×$500 + 1×$100 + 1×$25 + 1×$5 + 1×$1
    expect(breakdown(1631)).toEqual([
      { denomination: 1000, count: 1 },
      { denomination: 500, count: 1 },
      { denomination: 100, count: 1 },
      { denomination: 25, count: 1 },
      { denomination: 5, count: 1 },
      { denomination: 1, count: 1 },
    ])
  })
})
