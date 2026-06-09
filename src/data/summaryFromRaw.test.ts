import { describe, it, expect } from 'vitest'
import { summaryFromRaw } from './summaryFromRaw'

describe('summaryFromRaw', () => {
  describe('totalPot', () => {
    it('includes blind contributions when stakes are set — preflop-only hand', () => {
      // Preflop: SB=2 (blind), H raises to 15, BB calls 15 → 2+15+15 = 32
      const raw =
        '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c'
      expect(summaryFromRaw(raw).totalPot).toBe(32)
    })

    it('accumulates contributions across multiple streets', () => {
      // Preflop: SB=2, BB=25, H=25 → 52; Flop: BB=10, H=10 → 20; total = 72
      const raw =
        '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 25, BB c\nFlop: BB b 10, H c'
      expect(summaryFromRaw(raw).totalPot).toBe(72)
    })

    it('counts bets without stakes (blind amounts default to 0)', () => {
      // No stakes: SB=0, BB=12, H=12 → 24; Flop: H=30 → 30; total = 54
      const raw =
        'Board: Kd Qh Jc\nHero: CO 7s7d\nPreflop: H r 12, BB c\nFlop: BB x, H b 30, BB f'
      expect(summaryFromRaw(raw).totalPot).toBe(54)
    })

    it('is omitted from the summary when there are no contributions', () => {
      // No stakes → blind amounts = 0; only check/call at 0 → totalPot = 0 → field absent
      const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: SB c, BB x'
      const summary = summaryFromRaw(raw)
      expect(summary.totalPot).toBeUndefined()
      expect('totalPot' in summary).toBe(false)
    })

    it('includes all-in contributions', () => {
      // Preflop: SB=2→500 (calls), BB=5→500 (all-in), H=200 (raise); total = 1200
      const raw =
        '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 200, BB a 500, SB c'
      expect(summaryFromRaw(raw).totalPot).toBe(1200)
    })
  })

  describe('other summary fields', () => {
    const raw =
      '[Stakes: $2/$5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c\nFlop: BB x, H b 20, BB c'

    it('extracts heroPosition', () => {
      expect(summaryFromRaw(raw).heroPosition).toBe('BTN')
    })

    it('extracts heroCards', () => {
      expect(summaryFromRaw(raw).heroCards).toBe('AhKs')
    })

    it('extracts board cards', () => {
      expect(summaryFromRaw(raw).board).toEqual(['As', '8h', 'Td'])
    })

    it('extracts streetReached', () => {
      expect(summaryFromRaw(raw).streetReached).toBe('Flop')
    })

    it('extracts stakes', () => {
      expect(summaryFromRaw(raw).stakes).toBe('$2/$5')
    })

    it('omits stakes field when not present in raw', () => {
      const noStakes = 'Board: Kd Qh Jc\nHero: CO 7s7d\nPreflop: H r 12, BB c'
      expect(summaryFromRaw(noStakes).stakes).toBeUndefined()
      expect('stakes' in summaryFromRaw(noStakes)).toBe(false)
    })
  })
})
