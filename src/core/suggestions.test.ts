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
