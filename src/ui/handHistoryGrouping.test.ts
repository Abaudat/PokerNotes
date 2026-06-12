import { describe, it, expect } from 'vitest'
import { groupHandsByDate, dateGroupLabel } from './handHistoryGrouping'
import type { ListedHand } from '../data/repository'

const NOW = new Date(2026, 5, 12, 18, 30) // Jun 12, 2026

function hand(id: string, createdAt: Date): ListedHand {
  return {
    id,
    createdAt,
    summary: { board: [], heroCards: 'AhKs', heroPosition: 'BTN', streetReached: 'Preflop' },
  }
}

describe('dateGroupLabel', () => {
  it('labels a date on the same calendar day as now "Today"', () => {
    expect(dateGroupLabel(new Date(2026, 5, 12, 1, 0), NOW)).toBe('Today')
  })

  it('labels a date on the previous calendar day "Yesterday"', () => {
    expect(dateGroupLabel(new Date(2026, 5, 11, 23, 59), NOW)).toBe('Yesterday')
  })

  it('labels older dates with the formatted date', () => {
    const date = new Date(2026, 5, 1, 12, 0)
    expect(dateGroupLabel(date, NOW)).toBe(
      date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    )
  })
})

describe('groupHandsByDate', () => {
  it('returns no groups for an empty list', () => {
    expect(groupHandsByDate([], NOW)).toEqual([])
  })

  it('puts hands recorded on the same calendar day into a single group', () => {
    const hands = [hand('a', new Date(2026, 5, 12, 18, 0)), hand('b', new Date(2026, 5, 12, 9, 0))]
    expect(groupHandsByDate(hands, NOW)).toHaveLength(1)
  })

  it('splits hands recorded on different calendar days into separate groups', () => {
    const hands = [hand('a', new Date(2026, 5, 12, 9, 0)), hand('b', new Date(2026, 5, 11, 9, 0))]
    expect(groupHandsByDate(hands, NOW)).toHaveLength(2)
  })

  it('preserves the order of hands within a group', () => {
    const hands = [hand('a', new Date(2026, 5, 12, 18, 0)), hand('b', new Date(2026, 5, 12, 9, 0))]
    expect(groupHandsByDate(hands, NOW)[0].hands.map((h) => h.id)).toEqual(['a', 'b'])
  })

  it('labels each group from its hands\' calendar day', () => {
    const hands = [hand('a', new Date(2026, 5, 12, 9, 0)), hand('b', new Date(2026, 5, 11, 9, 0))]
    expect(groupHandsByDate(hands, NOW).map((g) => g.label)).toEqual(['Today', 'Yesterday'])
  })
})
