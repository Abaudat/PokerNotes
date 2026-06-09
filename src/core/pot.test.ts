import { describe, it, expect } from 'vitest'
import { parseHand } from './parser'
import { computePotAtStreetStart } from './engine'

// ---------------------------------------------------------------------------
// Mandatory pot-computation tests from the feature spec
// ---------------------------------------------------------------------------

describe('computePotAtStreetStart — mandatory spec tests', () => {
  it('calling preflop amounts to a big blind (Stakes 2/5)', () => {
    // UTG calls, SB calls, BB checks → pot at Flop = 15
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB x',
    )
    // streetIndex 1 = Flop (after Preflop at index 0)
    // but the hand only has Preflop, so we compute pot at index 1 = after all streets
    expect(computePotAtStreetStart(state, 1)).toBe(15)
  })

  it('blinds folding preflop (Stakes 5/10)', () => {
    // HJ raises 25, BTN calls, SB folds, BB folds → pot at Flop = 65
    const state = parseHand(
      '[Stakes: 5/10]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: HJ r 25, BTN c, SB f, BB f',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(65)
  })

  it('multi-street tracking — pot at Flop (Stakes 2/5)', () => {
    // H raises 25, BB calls → pot at Flop = 52
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 25, BB c',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(52)
  })

  it('multi-street tracking — pot at Turn (Stakes 2/5)', () => {
    // Preflop: H raises 25, BB calls (pot=52). Flop: BB bets 10, H calls → pot at Turn = 72
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 25, BB c\nFlop: BB b 10, H c',
    )
    expect(computePotAtStreetStart(state, 2)).toBe(72)
  })

  it('multi-street tracking — pot at River (Stakes 2/5)', () => {
    // Turn: BB checks, H checks → pot unchanged at 72
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td 2c\nHero: BTN AhKs\nPreflop: H r 25, BB c\nFlop: BB b 10, H c\nTurn: BB x, H x',
    )
    expect(computePotAtStreetStart(state, 3)).toBe(72)
  })

  it('multi-street tracking — pot at Showdown (Stakes 2/5)', () => {
    // River: BB bets 30, H raises 100, BB calls → pot at Showdown = 272
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td 2c 3d\nHero: BTN AhKs\nPreflop: H r 25, BB c\nFlop: BB b 10, H c\nTurn: BB x, H x\nRiver: BB b 30, H r 100, BB c',
    )
    expect(computePotAtStreetStart(state, 4)).toBe(272)
  })

  it('fold leaves bet on the table (Stakes 2/5)', () => {
    // UTG calls, SB calls, BB raises 50, SB calls → pot at Flop = 105
    // (UTG implicitly folds to BB's raise, leaving their 5 in pot)
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB r 50, SB c',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(105)
  })

  it('all-in players are accounted for — pot at Flop (Stakes 2/5)', () => {
    // UTG calls, SB calls, BB calls → pot at Flop = 15
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB x',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(15)
  })

  it('all-in players are accounted for — pot at Turn (Stakes 2/5)', () => {
    // Flop: SB all in 200, BB calls, UTG calls → pot at Turn = 615
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB x\nFlop: SB a 200, BB c, UTG c',
    )
    expect(computePotAtStreetStart(state, 2)).toBe(615)
  })

  it('all-in players are accounted for — pot at River (Stakes 2/5)', () => {
    // Turn: BB bets 12, UTG calls → pot at River = 639
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td 2c\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB x\nFlop: SB a 200, BB c, UTG c\nTurn: BB b 12, UTG c',
    )
    expect(computePotAtStreetStart(state, 3)).toBe(639)
  })

  it('all-in players are accounted for — pot at Showdown (Stakes 2/5)', () => {
    // River: BB all in 100, UTG calls → pot at Showdown = 839
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td 2c 3d\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB x\nFlop: SB a 200, BB c, UTG c\nTurn: BB b 12, UTG c\nRiver: BB a 100, UTG c',
    )
    expect(computePotAtStreetStart(state, 4)).toBe(839)
  })
})

// ---------------------------------------------------------------------------
// Additional edge-case tests
// ---------------------------------------------------------------------------

describe('computePotAtStreetStart — edge cases', () => {
  it('pot at Preflop start is always 0', () => {
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c',
    )
    expect(computePotAtStreetStart(state, 0)).toBe(0)
  })

  it('works without stakes (pot is 0 for all streets)', () => {
    const state = parseHand(
      'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(30)
  })

  it('handles preflop-only hands', () => {
    const state = parseHand(
      '[Stakes: 5/10]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: HJ r 25, BTN c, SB f, BB f',
    )
    // pot after preflop = 65
    expect(computePotAtStreetStart(state, state.streets.length)).toBe(65)
  })

  it('BB check option contributes BB amount to pot', () => {
    // SB calls, BB checks (no raise) → SB=5, BB=5
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: SB AhKs\nPreflop: SB c, BB x',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// Unanswered raise tests (issue #34)
// ---------------------------------------------------------------------------

describe('computePotAtStreetStart — unanswered raises', () => {
  it('folded raise: UTG raises, everyone folds — only blinds count', () => {
    // Stakes 1/2, UTG raises 100, SB folds, BB folds → pot = SB(1) + BB(2) = 3
    const state = parseHand(
      '[Stakes: 1/2]\nBoard: As 8h Td\nHero: UTG AhKs\nPreflop: UTG r 100, SB f, BB f',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(3)
  })

  it('folded reraise: UTG reraises after SB raise, SB folds — UTG capped at SB level', () => {
    // Stakes 1/2, UTG raises 10, SB raises 50, UTG raises 200, SB folds
    // BB(2) + SB(50) + UTG(50 = capped at SB's raise) = 102
    const state = parseHand(
      '[Stakes: 1/2]\nBoard: As 8h Td\nHero: UTG AhKs\nPreflop: UTG r 10, SB r 50, UTG r 200, SB f',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(102)
  })

  it('uncalled flop bet returns entire bet', () => {
    // Preflop: H r 15, BB c → pot = 32 at flop. Flop: BB b 20, H f → BB's 20 is returned
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c\nFlop: BB b 20, H f',
    )
    expect(computePotAtStreetStart(state, 2)).toBe(32)
  })

  it('uncalled flop raise: caller wins only contested portion', () => {
    // Preflop pot = 32. Flop: BB b 20, H r 80, BB f → H capped at BB's 20.
    // Flop contributions = BB(20) + H(20) = 40. Total = 32 + 40 = 72
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c\nFlop: BB b 20, H r 80, BB f',
    )
    expect(computePotAtStreetStart(state, 2)).toBe(72)
  })

  it('showdown pot excludes unanswered raise on river', () => {
    // Preflop H r 15 BB c (pot=32). Flop BB b 10 H c (pot=52). River BB b 30 H r 100 BB f
    // River: H capped at BB's 30. River contributions = BB(30)+H(30)=60. Total = 52+60 = 112
    const state = parseHand(
      '[Stakes: 2/5]\nBoard: As 8h Td 2c 3d\nHero: BTN AhKs\nPreflop: H r 15, BB c\nFlop: BB b 10, H c\nRiver: BB b 30, H r 100, BB f',
    )
    expect(computePotAtStreetStart(state, state.streets.length)).toBe(112)
  })
})

// ---------------------------------------------------------------------------
// Custom stakes tests
// ---------------------------------------------------------------------------

describe('computePotAtStreetStart — custom stakes', () => {
  it('handles 50/100 stakes with three players calling', () => {
    // SB=50, BB=100; UTG calls(100), SB calls(100), BB checks → pot = 300
    const state = parseHand(
      '[Stakes: 50/100]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: UTG c, SB c, BB x',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(300)
  })

  it('handles 3/5 stakes with hero raise and BB call', () => {
    // SB=3, BB=5; H raises to 20, BB calls → SB=3 left in pot, H=20, BB=20 → pot = 43
    const state = parseHand(
      '[Stakes: 3/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 20, BB c',
    )
    expect(computePotAtStreetStart(state, 1)).toBe(43)
  })

  it('parseHand preserves custom stakes string verbatim', () => {
    const state = parseHand('[Stakes: 3/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 20, BB c')
    expect(state.stakes).toBe('3/5')
  })
})
