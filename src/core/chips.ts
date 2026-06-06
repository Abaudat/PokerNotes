export interface Chip {
  denomination: number
  count: number
}

const DEFAULT_DENOMS: readonly number[] = [1000, 500, 100, 25, 5, 1]

/**
 * Greedy chip breakdown: largest denominations first.
 * Returns only denominations with count > 0.
 */
export function breakdown(amount: number, denoms: readonly number[] = DEFAULT_DENOMS): Chip[] {
  const result: Chip[] = []
  let remaining = amount

  for (const denom of denoms) {
    if (remaining <= 0) break
    const count = Math.floor(remaining / denom)
    if (count > 0) {
      result.push({ denomination: denom, count })
      remaining -= count * denom
    }
  }

  return result
}
