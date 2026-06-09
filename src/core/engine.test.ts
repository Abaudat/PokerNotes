import { describe, it, expect } from 'vitest'
import { parseCard } from './cards'
import { parseHand } from './parser'
import {
  nextStep,
  legalActorsToAct,
  legalVerbs,
  canAdvanceStreet,
  showdownEligibleActors,
  foldedActors,
  isComplete,
  hasBetOrRaise,
  legalActorsForActionSlot,
  legalVerbsForActionSlot,
  legalShowdownActorsForSlot,
} from './engine'
import type { Action, Card, HandState, Position, Street, StreetName, Verb } from './types'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

let idc = 0
const C = (code: string): Card => parseCard(code)!

function action(spec: string): Action {
  const p = spec.trim().split(/\s+/)
  const actor = p[0] as Position
  if (p.length === 1) return { id: `a${idc++}`, actor }
  if (p[1] === 'all' && p[2] === 'in') {
    const amt = p[3] !== undefined ? Number(p[3]) : undefined
    return { id: `a${idc++}`, actor, verb: 'a', ...(amt !== undefined ? { amount: amt } : {}) }
  }
  const verb = p[1] as Verb
  const amount = p[2] !== undefined ? Number(p[2]) : undefined
  return { id: `a${idc++}`, actor, verb, ...(amount !== undefined ? { amount } : {}) }
}

function acts(spec: string): Action[] {
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map(action)
}

function street(name: StreetName, spec: string): Street {
  return { name, actions: acts(spec) }
}

const DEFAULT_BOARD = [C('As'), C('8h'), C('Td')]

function st(p: Partial<HandState> = {}): HandState {
  return {
    id: 'h',
    streets: [],
    notes: [],
    board: DEFAULT_BOARD,
    hero: { position: 'BTN', cards: [C('Ah'), C('Ks')] },
    ...p,
  }
}

// ===========================================================================
// nextStep — setup steps
// ===========================================================================

describe('nextStep — setup', () => {
  it('asks for the board when board is unset', () => {
    expect(nextStep(st({ board: undefined })).kind).toBe('board')
  })

  it('asks for hero position when hero is unset', () => {
    const step = nextStep(st({ hero: undefined }))
    expect(step.kind).toBe('heroPosition')
    if (step.kind === 'heroPosition') {
      for (const pos of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']) {
        expect(step.options).toContain(pos)
      }
    }
  })

  it('asks for hero cards when position chosen but cards pending', () => {
    expect(nextStep(st({ hero: { position: 'BTN' } })).kind).toBe('heroCards')
  })

  it('asks for the first actor once hero is complete and no streets exist', () => {
    const step = nextStep(st({ streets: [] }))
    expect(step.kind).toBe('actor')
    if (step.kind === 'actor') expect(step.street).toBe('Preflop')
  })
})

// ===========================================================================
// legalActorsToAct — preflop ordering
// ===========================================================================

describe('legalActorsToAct — preflop', () => {
  it('excludes positions that have already spoken', () => {
    const opts = legalActorsToAct('Preflop', acts('HJ b 50'), [])
    for (const p of ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'HJ']) expect(opts).not.toContain(p)
    for (const p of ['CO', 'BTN', 'SB', 'BB']) expect(opts).toContain(p)
  })

  it('suggests positions in CO > BTN > SB > BB order', () => {
    const opts = legalActorsToAct('Preflop', acts('HJ b 50'), [])
    expect(opts.indexOf('CO')).toBeLessThan(opts.indexOf('BTN'))
    expect(opts.indexOf('BTN')).toBeLessThan(opts.indexOf('SB'))
    expect(opts.indexOf('SB')).toBeLessThan(opts.indexOf('BB'))
  })

  it('drops H from suggestions after H has spoken', () => {
    expect(legalActorsToAct('Preflop', acts('H r 40'), [])).not.toContain('H')
  })

  it('after a raise includes first timers (after raiser) and second timers (spoke before)', () => {
    const opts = legalActorsToAct('Preflop', acts('HJ b 50, CO c, BTN r 100'), [])
    expect(opts).toContain('SB')
    expect(opts).toContain('BB')
    expect(opts).toContain('HJ')
    expect(opts).toContain('CO')
    expect(opts).not.toContain('BTN') // raiser
    expect(opts).not.toContain('UTG') // skipped before HJ
  })

  it('first timers appear before second timers', () => {
    const opts = legalActorsToAct('Preflop', acts('HJ b 50, CO c, BTN r 100'), [])
    expect(opts.indexOf('SB')).toBeLessThan(opts.indexOf('HJ'))
    expect(opts.indexOf('BB')).toBeLessThan(opts.indexOf('CO'))
  })

  it('treats all-in the same as a raise', () => {
    const opts = legalActorsToAct('Preflop', acts('HJ b 50, BTN all in'), [])
    expect(opts).toContain('SB')
    expect(opts).toContain('BB')
    expect(opts).toContain('HJ')
    expect(opts).not.toContain('BTN')
  })

  it('after a re-open and a response, skips bypassed positions (implied fold)', () => {
    // UTG bets, HJ calls, SB raises, UTG calls before BB acts => BB implied fold;
    // only HJ (not yet responded to SB) remains.
    const opts = legalActorsToAct('Preflop', acts('UTG b 5, HJ c, SB r 25, UTG c'), [])
    expect(opts).toEqual(['HJ'])
  })
})

// ===========================================================================
// legalActorsToAct — postflop
// ===========================================================================

describe('legalActorsToAct — postflop', () => {
  it('suggests only positions active entering the street', () => {
    const opts = legalActorsToAct('Flop', [], ['HJ', 'BTN', 'SB'])
    expect(opts).toContain('HJ')
    expect(opts).toContain('BTN')
    expect(opts).toContain('SB')
    expect(opts).not.toContain('UTG')
    expect(opts).not.toContain('CO')
  })

  it('suggests the blinds first, in SB > BB > ... order', () => {
    const opts = legalActorsToAct('Flop', [], ['HJ', 'BTN', 'SB', 'BB'])
    expect(opts).toEqual(['SB', 'BB', 'HJ', 'BTN'])
  })

  it('suggests only positions after the last actor', () => {
    const opts = legalActorsToAct('Flop', acts('SB x'), ['HJ', 'BTN', 'SB'])
    expect(opts).toContain('HJ')
    expect(opts).toContain('BTN')
    expect(opts).not.toContain('SB')
  })

  it('after a blind acts, later positions still get to act (no implied folds)', () => {
    // BB acts first (SB folded preflop); UTG..BTN must still be offered.
    const opts = legalActorsToAct('Flop', acts('BB x'), ['BB', 'UTG', 'BTN'])
    expect(opts).toContain('UTG')
    expect(opts).toContain('BTN')
    expect(opts).not.toContain('BB')
  })

  it('after a raise includes second timers, excludes the raiser', () => {
    const opts = legalActorsToAct('Flop', acts('HJ x, CO x, BTN b 30'), ['HJ', 'CO', 'BTN'])
    expect(opts).toContain('HJ')
    expect(opts).toContain('CO')
    expect(opts).not.toContain('BTN')
  })
})

// ===========================================================================
// Active / folded tracking
// ===========================================================================

describe('folded / active tracking', () => {
  it('excludes explicit preflop folders from showdown pool', () => {
    const state = st({ streets: [street('Preflop', 'HJ b 25, CO c, SB r 100, BB f, HJ c, CO c')] })
    const folded = foldedActors(state)
    expect(folded.has('BB')).toBe(true)
    expect(folded.has('HJ')).toBe(false)
    expect(folded.has('CO')).toBe(false)
    expect(folded.has('SB')).toBe(false)
  })

  it('excludes implicit preflop folders (bypassed in re-open order)', () => {
    const state = st({ streets: [street('Preflop', 'HJ b 25, CO r 50, BB c')] })
    expect(foldedActors(state).has('HJ')).toBe(true)
  })

  it('tracks an explicit fold on a postflop street', () => {
    const state = st({
      board: [C('As'), C('8h'), C('Td'), C('2c')],
      streets: [street('Preflop', 'UTG b 5, SB r 25, BB c, UTG c'), street('Flop', 'UTG x, SB f, BB x')],
    })
    expect(foldedActors(state).has('SB')).toBe(true)
  })

  it('tracks an implicit fold on a postflop street', () => {
    const state = st({
      board: [C('As'), C('8h'), C('Td'), C('2c')],
      streets: [street('Preflop', 'HJ b 10, CO c, SB c'), street('Flop', 'CO b 20, SB r 80, HJ c')],
    })
    expect(foldedActors(state).has('CO')).toBe(true)
  })
})

// ===========================================================================
// legalVerbs — facing-bet / BB option
// ===========================================================================

describe('legalVerbs', () => {
  it('non-BB preflop faces the implicit BB: call/raise/fold/all-in', () => {
    const r = legalVerbs('Preflop', 'H', [], 'BTN')
    expect(r.facingBet).toBe(true)
    expect(r.verbs).toContain('c')
    expect(r.verbs).toContain('r')
    expect(r.verbs).toContain('f')
    expect(r.verbs).not.toContain('x')
    expect(r.verbs).not.toContain('b')
  })

  it('BB preflop with no raise can check (option)', () => {
    const r = legalVerbs('Preflop', 'BB', [], 'BTN')
    expect(r.facingBet).toBe(false)
    expect(r.bbOption).toBe(true)
    expect(r.verbs).toContain('x')
    expect(r.verbs).toContain('r')
    expect(r.verbs).not.toContain('c')
  })

  it('BB preflop after a raise must call/raise', () => {
    const r = legalVerbs('Preflop', 'BB', acts('UTG r 15, CO c'), 'BTN')
    expect(r.facingBet).toBe(true)
    expect(r.verbs).toContain('c')
    expect(r.verbs).not.toContain('x')
  })

  it('resolves H to the hero position (hero in the BB gets the option)', () => {
    const r = legalVerbs('Preflop', 'H', [], 'BB')
    expect(r.facingBet).toBe(false)
    expect(r.bbOption).toBe(true)
  })

  it('postflop not facing a bet: check/bet/fold/all-in', () => {
    const r = legalVerbs('Flop', 'H', acts('CO x'), 'BTN')
    expect(r.facingBet).toBe(false)
    expect(r.verbs).toContain('x')
    expect(r.verbs).toContain('b')
  })

  it('postflop facing a bet: call/raise/fold/all-in', () => {
    const r = legalVerbs('Flop', 'H', acts('CO b 30'), 'BTN')
    expect(r.facingBet).toBe(true)
    expect(r.verbs).toContain('c')
    expect(r.verbs).not.toContain('x')
  })
})

describe('hasBetOrRaise', () => {
  it('false for checks/calls/folds', () => {
    expect(hasBetOrRaise(acts('BB x, H c'))).toBe(false)
  })
  it('true when any bet/raise/all-in present', () => {
    expect(hasBetOrRaise(acts('BB b 20, H c'))).toBe(true)
    expect(hasBetOrRaise(acts('H all in 200'))).toBe(true)
  })
})

// ===========================================================================
// nextStep — verb / actor integration & street advancement
// ===========================================================================

describe('nextStep — verb step', () => {
  it('a trailing verbless action yields a verb step with facingBet', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'H')] }))
    expect(step.kind).toBe('verb')
    if (step.kind === 'verb') {
      expect(step.actor).toBe('H')
      expect(step.facingBet).toBe(true)
    }
  })
})

describe('nextStep — street advancement flags', () => {
  it('canAdvance true after preflop with a 3-card board', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'H r 40, CO c')] }))
    expect(step.kind === 'actor' && step.canAdvance).toBe(true)
  })

  it('canAdvance false after preflop with a 0-card board', () => {
    const step = nextStep(st({ board: [], streets: [street('Preflop', 'H f')] }))
    expect(step.kind === 'actor' && step.canAdvance).toBe(false)
  })

  it('canAdvance false after flop with only 3 cards', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'H r 40, BB c'), street('Flop', 'BB x, H b 20, BB c')] }))
    expect(step.kind === 'actor' && step.canAdvance).toBe(false)
  })

  it('canSave true after a complete action', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'H r 40, CO c')] }))
    expect(step.kind === 'actor' && step.canSave).toBe(true)
  })

  it('canAdvanceStreet false on the river', () => {
    const state = st({
      board: [C('As'), C('8h'), C('Td'), C('2c'), C('7s')],
      streets: [street('Preflop', 'H r 40, BB c'), street('Flop', 'BB x, H x'), street('Turn', 'BB x, H x'), street('River', 'BB b 40, H c')],
    })
    expect(canAdvanceStreet(state)).toBe(false)
  })
})

// ===========================================================================
// Showdown eligibility
// ===========================================================================

describe('showdownEligibleActors', () => {
  it('excludes a player who folded preflop, keeps the caller', () => {
    const opts = showdownEligibleActors(st({ streets: [street('Preflop', 'H r 40, CO c, BB f')], showdown: [] }))
    expect(opts).not.toContain('BB')
    expect(opts).toContain('CO')
  })

  it('always offers the generic villain V', () => {
    expect(showdownEligibleActors(st({ streets: [street('Preflop', 'H c')], showdown: [] }))).toContain('V')
  })

  it('excludes actors passed in the exclude set (already shown)', () => {
    const state = st({ streets: [street('Preflop', 'H c')], showdown: [] })
    expect(showdownEligibleActors(state, new Set(['V']))).not.toContain('V')
  })
})

describe('nextStep — showdown', () => {
  it('enters showdown actor mode when a showdown list exists', () => {
    expect(nextStep(st({ streets: [street('Preflop', 'H c')], showdown: [] })).kind).toBe('showdownActor')
  })

  it('asks for the verb after a showdown actor is chosen', () => {
    const state = st({ streets: [street('Preflop', 'H c')], showdown: [{ id: 's1', actor: 'V' }] })
    const step = nextStep(state)
    expect(step.kind).toBe('showdownVerb')
  })

  it('asks for cards when a player shows', () => {
    const state = st({ streets: [street('Preflop', 'H c')], showdown: [{ id: 's1', actor: 'V', verb: 'shows' }] })
    expect(nextStep(state).kind).toBe('showdownCards')
  })
})

// ===========================================================================
// Edit-option helpers — THE BUG FIX: editing offers only legal options
// ===========================================================================

describe('edit-option restriction (regression)', () => {
  it('editing a showdown actor offers only players still in the hand, not all positions', () => {
    // HJ raise, CO call, BB call preflop; flop HJ bet, BB call (CO implicitly folds); HJ wins.
    const state = parseHand(
      'Board: As 8h Td\nHero: BTN AhKs\nPreflop: HJ r 15, CO c, BB c\nFlop: HJ b 15, BB c\nShowdown: HJ wins',
    )
    const opts = legalShowdownActorsForSlot(state, 0)
    expect(opts).toContain('HJ')
    expect(opts).toContain('BB')
    expect(opts).toContain('H')
    expect(opts).toContain('V')
    for (const p of ['CO', 'UTG', 'BTN', 'SB']) expect(opts).not.toContain(p)
  })

  it('editing a postflop actor offers only preflop actors, not all positions', () => {
    const state = parseHand(
      'Board: As 8h Td\nHero: BTN AhKs\nPreflop: HJ b 50, BTN c, SB c\nFlop: BTN x, SB x, HJ x',
    )
    const opts = legalActorsForActionSlot(state, 'Flop', 0)
    expect(opts).toContain('HJ')
    expect(opts).toContain('BTN')
    expect(opts).toContain('SB')
    expect(opts).not.toContain('UTG')
    expect(opts).not.toContain('CO')
  })

  it('editing a verb facing a bet offers call/raise/fold/all-in (not check/bet)', () => {
    const state = parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB r 20, H c')
    const { verbs, facingBet } = legalVerbsForActionSlot(state, 'Preflop', 1)
    expect(facingBet).toBe(true)
    expect(verbs).toContain('c')
    expect(verbs).not.toContain('x')
    expect(verbs).not.toContain('b')
  })
})

// ===========================================================================
// All-in player handling (issue #26)
// ===========================================================================

describe('all-in player handling', () => {
  it('all-in player from preflop is not suggested as an actor on the flop', () => {
    // HJ went all-in preflop — only SB and BB should be offered on the flop
    const opts = legalActorsToAct('Flop', [], ['HJ', 'SB', 'BB'], new Set(['HJ']))
    expect(opts).not.toContain('HJ')
    expect(opts).toContain('SB')
    expect(opts).toContain('BB')
  })

  it('all-in player is not an implicit folder when others bet on a later street', () => {
    // HJ all-in preflop; flop: SB bets, BB calls. HJ should NOT be marked as folded.
    const state = st({
      streets: [
        street('Preflop', 'HJ all in 50, SB c, BB c'),
        street('Flop', 'SB b 5, BB c'),
      ],
    })
    expect(foldedActors(state).has('HJ')).toBe(false)
  })

  it('all-in player from preflop is included in showdown suggestions', () => {
    // HJ all-in preflop; flop: SB bets, BB calls. HJ is still in the hand at showdown.
    const state = st({
      streets: [
        street('Preflop', 'HJ all in 50, SB c, BB c'),
        street('Flop', 'SB b 5, BB c'),
      ],
      showdown: [],
    })
    expect(showdownEligibleActors(state)).toContain('HJ')
  })

  it('nextStep on the flop does not suggest all-in player from preflop', () => {
    const state = st({
      streets: [
        street('Preflop', 'HJ all in 50, SB c, BB c'),
        { name: 'Flop' as const, actions: [] },
      ],
    })
    const step = nextStep(state)
    expect(step.kind).toBe('actor')
    if (step.kind === 'actor') {
      expect(step.options).not.toContain('HJ')
      expect(step.options).toContain('SB')
    }
  })

  it('all-in player is excluded from response order when flop has a bet', () => {
    // On the flop with HJ all-in from preflop, after SB bets only BB should respond
    const opts = legalActorsToAct('Flop', acts('SB b 5'), ['HJ', 'SB', 'BB'], new Set(['HJ']))
    expect(opts).not.toContain('HJ')
    expect(opts).toContain('BB')
    expect(opts).not.toContain('SB')
  })

  it('within-street all-in player is not re-queued to respond to a subsequent raise', () => {
    // HJ goes all-in preflop for $50; CO raises to $100. HJ cannot respond to CO's raise.
    const opts = legalActorsToAct('Preflop', acts('HJ all in 50, CO r 100'), [])
    expect(opts).not.toContain('HJ')
    expect(opts).toContain('SB')
    expect(opts).toContain('BB')
  })
})

// ===========================================================================
// isComplete
// ===========================================================================

describe('isComplete', () => {
  it('true for a fully recorded hand', () => {
    expect(isComplete(st({ streets: [street('Preflop', 'H r 40, CO c')] }))).toBe(true)
  })

  it('false when the board is unset', () => {
    expect(isComplete(st({ board: undefined, streets: [street('Preflop', 'H c')] }))).toBe(false)
  })

  it('false with a trailing verbless action', () => {
    expect(isComplete(st({ streets: [street('Preflop', 'H r 40, CO')] }))).toBe(false)
  })

  it('false when a showdown "shows" entry has no cards', () => {
    expect(isComplete(st({ streets: [street('Preflop', 'H c')], showdown: [{ id: 's', actor: 'V', verb: 'shows' }] }))).toBe(false)
  })
})
