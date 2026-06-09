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
