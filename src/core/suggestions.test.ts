import { describe, it, expect } from 'vitest'
import { nextSuggestions } from './suggestions'

// Reusable base hand with board + complete hero
const BOARD_ONLY = 'Board: As 8h Td'
const BASE = 'Board: As 8h Td\nHero: BTN AhKs'

// ---------------------------------------------------------------------------
// AWAIT_BOARD
// ---------------------------------------------------------------------------

describe('AWAIT_BOARD', () => {
  it('returns AWAIT_BOARD for empty input', () => {
    expect(nextSuggestions('').mode).toBe('AWAIT_BOARD')
  })

  it('returns AWAIT_BOARD for whitespace-only input', () => {
    expect(nextSuggestions('   \n  ').mode).toBe('AWAIT_BOARD')
  })

  it('returns AWAIT_BOARD when only stakes present', () => {
    expect(nextSuggestions('[Stakes: $2/$5]').mode).toBe('AWAIT_BOARD')
  })

  it('includes at least one card option and the NO_BOARD sentinel', () => {
    const r = nextSuggestions('')
    expect(r.options).toContain('NO_BOARD')
    // should include some card codes
    expect(r.options.some((o) => /^[2-9TJQKA][shdc]$/.test(o))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AWAIT_HERO_POS
// ---------------------------------------------------------------------------

describe('AWAIT_HERO_POS', () => {
  it('returns AWAIT_HERO_POS after a complete board', () => {
    const r = nextSuggestions(BOARD_ONLY)
    expect(r.mode).toBe('AWAIT_HERO_POS')
  })

  it('lists the standard hero-position options', () => {
    const r = nextSuggestions(BOARD_ONLY)
    for (const pos of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']) {
      expect(r.options).toContain(pos)
    }
  })

  it('also works with a 0-card (folded-pre) board', () => {
    expect(nextSuggestions('Board: ').mode).toBe('AWAIT_HERO_POS')
  })

  it('also works with a 4-card board', () => {
    expect(nextSuggestions('Board: As 8h Td 2c').mode).toBe('AWAIT_HERO_POS')
  })

  it('also works with a 5-card board', () => {
    expect(nextSuggestions('Board: As 8h Td 2c 7s').mode).toBe('AWAIT_HERO_POS')
  })
})

// ---------------------------------------------------------------------------
// AWAIT_HERO_CARDS
// ---------------------------------------------------------------------------

describe('AWAIT_HERO_CARDS', () => {
  it('returns AWAIT_HERO_CARDS when hero has position but no cards', () => {
    expect(nextSuggestions('Board: As 8h Td\nHero: BTN').mode).toBe('AWAIT_HERO_CARDS')
  })

  it('returns AWAIT_HERO_CARDS when hero has only 1 card', () => {
    // "Ah" packed after position
    expect(nextSuggestions('Board: As 8h Td\nHero: BTN Ah').mode).toBe('AWAIT_HERO_CARDS')
  })

  it('excludes board cards from the available options', () => {
    const r = nextSuggestions('Board: As 8h Td\nHero: BTN')
    expect(r.options).not.toContain('As')
    expect(r.options).not.toContain('8h')
    expect(r.options).not.toContain('Td')
    // But other cards are offered
    expect(r.options).toContain('Kc')
  })
})

// ---------------------------------------------------------------------------
// AWAIT_ACTOR
// ---------------------------------------------------------------------------

describe('AWAIT_ACTOR', () => {
  it('returns AWAIT_ACTOR when hero is complete and no streets exist', () => {
    const r = nextSuggestions(BASE)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.context?.street).toBe('Preflop')
  })

  it('returns AWAIT_ACTOR after a complete action in the current street', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c`)
    expect(r.mode).toBe('AWAIT_ACTOR')
  })

  it('includes H and standard positions in options', () => {
    const r = nextSuggestions(BASE)
    expect(r.options).toContain('H')
    expect(r.options).toContain('BB')
    expect(r.options).toContain('CO')
  })

  it('tracks the current street in context', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c`)
    expect(r.context?.street).toBe('Preflop')
  })

  it('tracks subsequent streets', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c\nFlop: CO x, H b 20, CO c`)
    expect(r.context?.street).toBe('Flop')
  })
})

// ---------------------------------------------------------------------------
// Preflop position ordering
// ---------------------------------------------------------------------------

describe('preflop position ordering', () => {
  it('excludes positions that have already spoken', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50,`)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).not.toContain('UTG')
    expect(r.options).not.toContain('UTG+1')
    expect(r.options).not.toContain('UTG+2')
    expect(r.options).not.toContain('UTG+3')
    expect(r.options).not.toContain('HJ')
    expect(r.options).toContain('CO')
    expect(r.options).toContain('BTN')
    expect(r.options).toContain('BB')
    expect(r.options).toContain('SB')
  })

  it('suggests positions in UTG > BTN > SB > BB order', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50,`)
    const opts = r.options
    expect(opts.indexOf('CO')).toBeLessThan(opts.indexOf('BTN'))
    expect(opts.indexOf('BTN')).toBeLessThan(opts.indexOf('SB'))
    expect(opts.indexOf('SB')).toBeLessThan(opts.indexOf('BB'))
  })

  it('removes H from suggestions after H has spoken', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40,`)
    expect(r.options).not.toContain('H')
  })

  it('after a raise includes unspoken positions after raiser and spoken positions', () => {
    // HJ bets, CO calls, BTN raises → SB+BB (first timers) and HJ+CO (second timers)
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, CO c, BTN r 100,`)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('SB')
    expect(r.options).toContain('BB')
    expect(r.options).toContain('HJ')
    expect(r.options).toContain('CO')
    expect(r.options).not.toContain('BTN')  // raiser not suggested
    expect(r.options).not.toContain('UTG')  // skipped (before HJ) not suggested
  })

  it('after a raise, first timers appear before second timers', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, CO c, BTN r 100,`)
    const opts = r.options
    expect(opts.indexOf('SB')).toBeLessThan(opts.indexOf('HJ'))
    expect(opts.indexOf('BB')).toBeLessThan(opts.indexOf('CO'))
  })

  it('after all-in, treats it the same as a raise', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, BTN all in,`)
    expect(r.options).toContain('SB')
    expect(r.options).toContain('BB')
    expect(r.options).toContain('HJ')
    expect(r.options).not.toContain('BTN')
  })
})

// ---------------------------------------------------------------------------
// Postflop position suggestions
// ---------------------------------------------------------------------------

describe('postflop position suggestions', () => {
  it('suggests only positions that appeared in preflop', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, BTN c, SB c\nFlop: `)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).not.toContain('UTG')
    expect(r.options).not.toContain('CO')
    expect(r.options).toContain('HJ')
    expect(r.options).toContain('BTN')
    expect(r.options).toContain('SB')
  })

  it('suggests only positions after the last actor on the current street', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, BTN c, SB c\nFlop: BTN x,`)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).not.toContain('HJ')
    expect(r.options).not.toContain('BTN')
    expect(r.options).toContain('SB')
  })

  it('resets available positions at the start of each new street', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, SB c\nFlop: HJ x, SB x\nTurn: `)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('HJ')
    expect(r.options).toContain('SB')
    expect(r.options).not.toContain('BTN')
  })

  it('excludes positions that explicitly folded in preflop', () => {
    // HJ bets, CO calls, SB raises, BB folds, HJ calls, CO calls
    // BB explicitly folded → not a postflop actor; HJ, CO, SB are active
    const raw = 'Board: As 8h Td\nHero: UTG AhKs\nPreflop: HJ b 25, CO c, SB r 100, BB f, HJ c, CO c\nFlop: '
    const r = nextSuggestions(raw)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('HJ')
    expect(r.options).toContain('CO')
    expect(r.options).toContain('SB')
    expect(r.options).not.toContain('BB')
  })

  it('excludes positions that implicitly folded in preflop (skipped in re-open response order)', () => {
    // HJ bets, CO raises, BB calls — HJ never responded to CO's raise.
    // BB (first timer after CO) called before HJ (second timer) got to act → HJ implicitly folded.
    const raw = 'Board: As 8h Td\nHero: UTG AhKs\nPreflop: HJ b 25, CO r 50, BB c\nFlop: '
    const r = nextSuggestions(raw)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('CO')
    expect(r.options).toContain('BB')
    expect(r.options).not.toContain('HJ')
  })

  it('postflop: after a raise includes first timers then second timers', () => {
    // Preflop: HJ, CO, SB. Flop: HJ checks, CO bets, SB raises
    const r = nextSuggestions(`${BASE}\nPreflop: HJ b 50, CO c, SB c\nFlop: HJ x, CO b 30, SB r 100,`)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('HJ')  // second timer
    expect(r.options).toContain('CO')  // second timer
    expect(r.options).not.toContain('SB')   // raiser
    expect(r.options).not.toContain('BTN')  // not a preflop actor
    // HJ and CO should be second timers — SB (last in order here) has no first timers after it among preflop actors
  })
})

  it('after a re-open and a response, skips positions that were bypassed (implied fold)', () => {
    // UTG bets, HJ calls, SB raises — UTG calls before BB acts => BB is implied fold
    // Only HJ (who has not yet responded to SB's raise) should be suggested
    const raw = 'Board: As 8h Td\nHero: UTG AhKs\nPreflop: UTG b 5, HJ c, SB r 25, UTG c,'
    const r = nextSuggestions(raw)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toEqual(['HJ'])
  })

// ---------------------------------------------------------------------------
// Multi-street fold tracking
// ---------------------------------------------------------------------------

describe('multi-street fold tracking', () => {
  it('excludes a player who explicitly folded on the flop from turn suggestions', () => {
    // Preflop: UTG, SB, BB active. Flop: SB folds. Turn: only UTG and BB remain.
    const raw = 'Board: As 8h Td 2c\nHero: UTG AhKs\nPreflop: UTG b 5, SB r 25, BB c, UTG c\nFlop: UTG x, SB f, BB x\nTurn: '
    const r = nextSuggestions(raw)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('UTG')
    expect(r.options).toContain('BB')
    expect(r.options).not.toContain('SB')
  })

  it('excludes a player who implicitly folded on the flop from turn suggestions', () => {
    // Preflop: HJ, CO, SB active. Flop: CO bets, SB raises, HJ calls (CO never responds → implied fold).
    const raw = 'Board: As 8h Td 2c\nHero: UTG AhKs\nPreflop: HJ b 10, CO c, SB c\nFlop: CO b 20, SB r 80, HJ c\nTurn: '
    const r = nextSuggestions(raw)
    expect(r.mode).toBe('AWAIT_ACTOR')
    expect(r.options).toContain('SB')
    expect(r.options).toContain('HJ')
    expect(r.options).not.toContain('CO')
  })
})

// ---------------------------------------------------------------------------
// AWAIT_VERB
// ---------------------------------------------------------------------------

describe('AWAIT_VERB — not facing a bet', () => {
  it('actor present without verb at start of street', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H`)
    expect(r.mode).toBe('AWAIT_VERB')
    expect(r.context?.facingBet).toBe(false)
  })

  it('offers check / bet / fold when not facing a bet', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H`)
    expect(r.options).toContain('x')
    expect(r.options).toContain('b')
    expect(r.options).toContain('f')
  })

  it('does NOT offer call or raise when not facing a bet', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H`)
    expect(r.options).not.toContain('c')
    expect(r.options).not.toContain('r')
  })

  it('not facing a bet after a check on a later street', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c\nFlop: CO x, H`)
    expect(r.mode).toBe('AWAIT_VERB')
    expect(r.context?.facingBet).toBe(false)
    expect(r.options).toContain('x')
    expect(r.options).toContain('b')
  })
})

describe('AWAIT_VERB — facing a bet', () => {
  it('canonical spec example: H r 40, CO → AWAIT_VERB with call/raise/fold', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO`)
    expect(r.mode).toBe('AWAIT_VERB')
    expect(r.context?.facingBet).toBe(true)
    expect(r.options).toContain('c')
    expect(r.options).toContain('r')
    expect(r.options).toContain('f')
  })

  it('does NOT offer check or bet when facing a raise', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO`)
    expect(r.options).not.toContain('x')
    expect(r.options).not.toContain('b')
  })

  it('facing a bet on the flop', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c\nFlop: CO b 30, H`)
    expect(r.mode).toBe('AWAIT_VERB')
    expect(r.context?.facingBet).toBe(true)
    expect(r.options).toContain('c')
    expect(r.options).toContain('r')
    expect(r.options).toContain('f')
  })

  it('facing a re-raise', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO r 120, H`)
    expect(r.mode).toBe('AWAIT_VERB')
    expect(r.context?.facingBet).toBe(true)
  })

  it('records the actor in context', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO`)
    expect(r.context?.actor).toBe('CO')
  })
})

// ---------------------------------------------------------------------------
// AWAIT_AMOUNT
// ---------------------------------------------------------------------------

describe('AWAIT_AMOUNT', () => {
  it('returns AWAIT_AMOUNT for raise without amount', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r`)
    expect(r.mode).toBe('AWAIT_AMOUNT')
  })

  it('returns AWAIT_AMOUNT for bet without amount', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c\nFlop: CO b`)
    expect(r.mode).toBe('AWAIT_AMOUNT')
  })

  it('records actor in context', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r`)
    expect(r.context?.actor).toBe('H')
  })

  it('records actor correctly for a later action', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO r`)
    expect(r.context?.actor).toBe('CO')
  })

  it('records the street in context', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r`)
    expect(r.context?.street).toBe('Preflop')
  })
})

// ---------------------------------------------------------------------------
// Street advancement (canAdvance / canSave in context)
// ---------------------------------------------------------------------------

describe('street advancement', () => {
  it('canAdvance is true after preflop when board has 3 cards', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c`)
    expect(r.context?.canAdvance).toBe(true)
  })

  it('canAdvance is false after preflop when board has 0 cards', () => {
    const r = nextSuggestions('Board: \nHero: BTN AhKs\nPreflop: H f')
    expect(r.context?.canAdvance).toBe(false)
  })

  it('canAdvance is true after flop when board has 4 cards', () => {
    const raw = 'Board: As 8h Td 2c\nHero: BTN AhKs\nPreflop: H r 40, BB c\nFlop: BB x, H b 20, BB c'
    const r = nextSuggestions(raw)
    expect(r.context?.canAdvance).toBe(true)
  })

  it('canAdvance is false after flop when board has only 3 cards', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, BB c\nFlop: BB x, H b 20, BB c`)
    expect(r.context?.canAdvance).toBe(false)
  })

  it('canAdvance is false after river', () => {
    const raw =
      'Board: As 8h Td 2c 7s\nHero: BTN AhKs\nPreflop: H r 40, BB c\nFlop: BB x, H b 20, BB c\nTurn: BB x, H x\nRiver: BB b 40, H c'
    const r = nextSuggestions(raw)
    expect(r.context?.canAdvance).toBe(false)
  })

  it('canSave is true after a complete action', () => {
    const r = nextSuggestions(`${BASE}\nPreflop: H r 40, CO c`)
    expect(r.context?.canSave).toBe(true)
  })
})
