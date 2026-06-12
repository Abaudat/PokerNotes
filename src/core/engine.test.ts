import { describe, it, expect } from 'vitest'
import { parseCard } from './cards'
import { parseHand } from './parser'
import { serializeHand } from './serializer'
import { buildHandViewModel, buildEditorView } from './render'
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
  legalActorsForNewActionOnStreet,
  legalVerbsForNewAction,
  legalVerbsForActorAtSlot,
  addAction,
  editAction,
  addNote,
  deleteNote,
  availableNoteAnchors,
  currentNoteAnchor,
  villainPosition,
  markerFor,
  markerLabel,
  setHeroCards,
  editHeroCard,
  setShowdownCards,
  editShowdownCard,
  beginShowdown,
  beginShowdownActor,
  setShowdownVerb,
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

  it('drops a position from suggestions after it has raised', () => {
    expect(legalActorsToAct('Preflop', acts('UTG r 40'), [])).not.toContain('UTG')
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
    const r = legalVerbs('Preflop', 'BTN', [])
    expect(r.facingBet).toBe(true)
    expect(r.verbs).toContain('c')
    expect(r.verbs).toContain('r')
    expect(r.verbs).toContain('f')
    expect(r.verbs).not.toContain('x')
    expect(r.verbs).not.toContain('b')
  })

  it('BB preflop with no raise can check (option)', () => {
    const r = legalVerbs('Preflop', 'BB', [])
    expect(r.facingBet).toBe(false)
    expect(r.bbOption).toBe(true)
    expect(r.verbs).toContain('x')
    expect(r.verbs).toContain('r')
    expect(r.verbs).not.toContain('c')
  })

  it('BB preflop after a raise must call/raise', () => {
    const r = legalVerbs('Preflop', 'BB', acts('UTG r 15, CO c'))
    expect(r.facingBet).toBe(true)
    expect(r.verbs).toContain('c')
    expect(r.verbs).not.toContain('x')
  })

  it('postflop not facing a bet: check/bet/fold/all-in', () => {
    const r = legalVerbs('Flop', 'BTN', acts('CO x'))
    expect(r.facingBet).toBe(false)
    expect(r.verbs).toContain('x')
    expect(r.verbs).toContain('b')
  })

  it('postflop facing a bet: call/raise/fold/all-in', () => {
    const r = legalVerbs('Flop', 'BTN', acts('CO b 30'))
    expect(r.facingBet).toBe(true)
    expect(r.verbs).toContain('c')
    expect(r.verbs).not.toContain('x')
  })
})

describe('hasBetOrRaise', () => {
  it('false for checks/calls/folds', () => {
    expect(hasBetOrRaise(acts('BB x, BTN c'))).toBe(false)
  })
  it('true when any bet/raise/all-in present', () => {
    expect(hasBetOrRaise(acts('BB b 20, BTN c'))).toBe(true)
    expect(hasBetOrRaise(acts('BTN all in 200'))).toBe(true)
  })
})

// ===========================================================================
// nextStep — verb / actor integration & street advancement
// ===========================================================================

describe('nextStep — verb step', () => {
  it('a trailing verbless action yields a verb step with facingBet', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'UTG')] }))
    expect(step.kind).toBe('verb')
    if (step.kind === 'verb') {
      expect(step.actor).toBe('UTG')
      expect(step.facingBet).toBe(true)
    }
  })
})

describe('nextStep — street advancement flags', () => {
  it('canAdvance true after preflop with a 3-card board', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'BTN r 40, CO c')] }))
    expect(step.kind === 'actor' && step.canAdvance).toBe(true)
  })

  it('canAdvance false after preflop with a 0-card board', () => {
    const step = nextStep(st({ board: [], streets: [street('Preflop', 'BTN f')] }))
    expect(step.kind === 'actor' && step.canAdvance).toBe(false)
  })

  it('canAdvance false after flop with only 3 cards', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'BTN r 40, BB c'), street('Flop', 'BB x, BTN b 20, BB c')] }))
    expect(step.kind === 'actor' && step.canAdvance).toBe(false)
  })

  it('canSave true after a complete action', () => {
    const step = nextStep(st({ streets: [street('Preflop', 'BTN r 40, CO c')] }))
    expect(step.kind === 'actor' && step.canSave).toBe(true)
  })

  it('canAdvanceStreet false on the river', () => {
    const state = st({
      board: [C('As'), C('8h'), C('Td'), C('2c'), C('7s')],
      streets: [street('Preflop', 'BTN r 40, BB c'), street('Flop', 'BB x, BTN x'), street('Turn', 'BB x, BTN x'), street('River', 'BB b 40, BTN c')],
    })
    expect(canAdvanceStreet(state)).toBe(false)
  })
})

// ===========================================================================
// Showdown eligibility
// ===========================================================================

describe('showdownEligibleActors', () => {
  it('excludes a player who folded preflop, keeps the caller', () => {
    const opts = showdownEligibleActors(st({ streets: [street('Preflop', 'BTN r 40, CO c, BB f')], showdown: [] }))
    expect(opts).not.toContain('BB')
    expect(opts).toContain('CO')
  })

  it('offers only seats still in the hand, never a generic villain', () => {
    const opts = showdownEligibleActors(st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [] }))
    expect(opts).toContain('BTN')
    expect(opts).toContain('BB')
    expect(opts).not.toContain('V')
    expect(opts).not.toContain('H')
  })

  it('excludes actors passed in the exclude set (already shown)', () => {
    const state = st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [] })
    expect(showdownEligibleActors(state, new Set(['BB']))).not.toContain('BB')
  })
})

describe('nextStep — showdown', () => {
  it('enters showdown actor mode when a showdown list exists', () => {
    expect(nextStep(st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [] })).kind).toBe('showdownActor')
  })

  it('asks for the verb after a showdown actor is chosen', () => {
    const state = st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [{ id: 's1', actor: 'BB' }] })
    const step = nextStep(state)
    expect(step.kind).toBe('showdownVerb')
  })

  it('asks for cards when a player shows', () => {
    const state = st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [{ id: 's1', actor: 'BB', verb: 'shows' }] })
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
    const state = parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB r 20, BTN c')
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

// ===========================================================================
// Hero / villain marker derivation
// ===========================================================================

describe('villainPosition', () => {
  it('is the lone non-hero seat when heads-up by the flop', () => {
    // Hero BTN calls, BB checks → BTN and BB see the flop heads-up.
    const state = st({ hero: { position: 'BTN', cards: [C('Ah'), C('Ks')] }, streets: [street('Preflop', 'BTN c, BB x')] })
    expect(villainPosition(state)).toBe('BB')
  })

  it('is undefined when more than one villain reaches the flop', () => {
    const state = st({ streets: [street('Preflop', 'CO c, BTN c, BB x')] })
    expect(villainPosition(state)).toBeUndefined()
  })

  it('is undefined when the hero is not in the flop pool', () => {
    // Hero BTN folds preflop; SB and BB go heads-up — no hero/villain frame.
    const state = st({ streets: [street('Preflop', 'BTN f, SB c, BB x')] })
    expect(villainPosition(state)).toBeUndefined()
  })

  it('reflects players folding to leave a single villain', () => {
    // UTG raises, hero BTN calls, blinds fold → heads-up BTN vs UTG.
    const state = st({ hero: { position: 'BTN', cards: [C('Ah'), C('Ks')] }, streets: [street('Preflop', 'UTG r 15, BTN c, SB f, BB f')] })
    expect(villainPosition(state)).toBe('UTG')
  })
})

describe('markerFor / markerLabel', () => {
  const headsUp = st({ hero: { position: 'BTN', cards: [C('Ah'), C('Ks')] }, streets: [street('Preflop', 'BTN c, BB x')] })

  it('marks the hero seat H and the lone villain V', () => {
    expect(markerFor(headsUp, 'BTN')).toBe('H')
    expect(markerFor(headsUp, 'BB')).toBe('V')
  })

  it('leaves other seats unmarked', () => {
    const multiway = st({ streets: [street('Preflop', 'CO c, BTN c, BB x')] })
    expect(markerFor(multiway, 'CO')).toBeUndefined()
    expect(markerFor(multiway, 'BB')).toBeUndefined()
  })

  it('formats marked seats as "H (pos)" / "V (pos)"', () => {
    expect(markerLabel('BTN', 'H')).toBe('H (BTN)')
    expect(markerLabel('BB', 'V')).toBe('V (BB)')
    expect(markerLabel('CO', undefined)).toBe('CO')
  })
})

describe('isComplete', () => {
  it('true for a fully recorded hand', () => {
    expect(isComplete(st({ streets: [street('Preflop', 'BTN r 40, CO c')] }))).toBe(true)
  })

  it('false when the board is unset', () => {
    expect(isComplete(st({ board: undefined, streets: [street('Preflop', 'BTN c')] }))).toBe(false)
  })

  it('false with a trailing verbless action', () => {
    expect(isComplete(st({ streets: [street('Preflop', 'BTN r 40, CO')] }))).toBe(false)
  })

  it('false when a showdown "shows" entry has no cards', () => {
    expect(isComplete(st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [{ id: 's', actor: 'BB', verb: 'shows' }] }))).toBe(false)
  })
})

// ===========================================================================
// legalActorsForNewActionOnStreet
// ===========================================================================

describe('legalActorsForNewActionOnStreet', () => {
  it('returns remaining implicit folders for preflop raise-call', () => {
    // UTG raise 10, CO call → BTN, SB, BB can still act
    const state = st({
      streets: [
        street('Preflop', 'UTG r 10, CO c'),
        street('Flop', 'CO x'),
      ],
    })
    const opts = legalActorsForNewActionOnStreet(state, 'Preflop')
    expect(opts).toContain('BTN')
    expect(opts).toContain('SB')
    expect(opts).toContain('BB')
    expect(opts).not.toContain('UTG')
    expect(opts).not.toContain('CO')
  })

  it('returns empty when all actors have spoken on preflop', () => {
    // UTG raise, CO call, BB call → no one left
    const state = st({
      streets: [
        street('Preflop', 'UTG r 10, CO c, BB c'),
        street('Flop', 'BB x'),
      ],
    })
    expect(legalActorsForNewActionOnStreet(state, 'Preflop')).toEqual([])
  })

  it('returns empty for flop when all actors responded to the bet', () => {
    // Preflop: UTG raise, CO call, BB call; Flop: BB bets, CO calls → UTG implicit fold, no more actors
    const state = st({
      streets: [
        street('Preflop', 'UTG r 10, CO c, BB c'),
        street('Flop', 'BB b 15, CO c'),
        street('Turn', 'BB x'),
      ],
    })
    expect(legalActorsForNewActionOnStreet(state, 'Flop')).toEqual([])
  })

  it('returns actor after editing flop actor creates an implicit fold opportunity', () => {
    // Preflop: UTG raise, CO call, BB call; Flop: BB bets, UTG calls (CO implicitly folded)
    // → CO can still act on Flop
    const state = st({
      streets: [
        street('Preflop', 'UTG r 10, CO c, BB c'),
        street('Flop', 'BB b 15, UTG c'),
        street('Turn', 'BB x'),
      ],
    })
    const opts = legalActorsForNewActionOnStreet(state, 'Flop')
    expect(opts).toContain('CO')
    expect(opts).not.toContain('BB')
    expect(opts).not.toContain('UTG')
  })

  it('returns empty for an unknown street', () => {
    const state = st({ streets: [street('Preflop', 'BTN c, BB x')] })
    expect(legalActorsForNewActionOnStreet(state, 'Flop')).toEqual([])
  })
})

// ===========================================================================
// Card ordering — highest rank displayed first (e2e)
// ===========================================================================

describe('card ordering — hero hand', () => {
  it('setHeroCards stores higher rank first when lower rank is given first', () => {
    const base = st({ hero: { position: 'BTN' } })
    const result = setHeroCards(base, [C('Kh'), C('Ad')])
    expect(result.hero!.cards![0]).toEqual(C('Ad'))
    expect(result.hero!.cards![1]).toEqual(C('Kh'))
  })

  it('setHeroCards preserves order when already highest rank first', () => {
    const base = st({ hero: { position: 'BTN' } })
    const result = setHeroCards(base, [C('Ad'), C('Kh')])
    expect(result.hero!.cards![0]).toEqual(C('Ad'))
    expect(result.hero!.cards![1]).toEqual(C('Kh'))
  })

  it('editHeroCard re-sorts so the new highest rank is first', () => {
    // State has QdTh; user edits slot 1 (Th) to As → should become AsQd
    const base = st({ hero: { position: 'BTN', cards: [C('Qd'), C('Th')] } })
    const result = editHeroCard(base, 1, C('As'))
    expect(result.hero!.cards![0]).toEqual(C('As'))
    expect(result.hero!.cards![1]).toEqual(C('Qd'))
  })

  it('editHeroCard re-sorts when editing slot 0 produces a lower-rank card', () => {
    // State has AsQd; user edits slot 0 (As) to 2c → should become Qd2c
    const base = st({ hero: { position: 'BTN', cards: [C('As'), C('Qd')] } })
    const result = editHeroCard(base, 0, C('2c'))
    expect(result.hero!.cards![0]).toEqual(C('Qd'))
    expect(result.hero!.cards![1]).toEqual(C('2c'))
  })

  it('hero cards appear in highest-rank-first order in the serialized hand', () => {
    const base = st({ hero: { position: 'BTN' } })
    const withCards = setHeroCards(base, [C('Kh'), C('Ad')])
    const serialized = serializeHand(withCards)
    expect(serialized).toContain('Hero: BTN AdKh')
  })

  it('hero cards appear in highest-rank-first order in the editor view chip text', () => {
    const base = st({ hero: { position: 'BTN' } })
    const withCards = setHeroCards(base, [C('Kh'), C('Ad')])
    const chips = buildEditorView(withCards).flatMap((l) => l.chips)
    const heroCardChips = chips.filter((c) => c.kind === 'hero-card').map((c) => c.text)
    expect(heroCardChips[0]).toContain('A')
    expect(heroCardChips[1]).toContain('K')
  })

  it('hero cards appear in highest-rank-first order in the hand view model', () => {
    const base = st({ hero: { position: 'BTN' } })
    const withCards = setHeroCards(base, [C('Kh'), C('Ad')])
    const vm = buildHandViewModel(withCards)
    expect(vm.hero.cards[0]).toBe('Ad')
    expect(vm.hero.cards[1]).toBe('Kh')
  })
})

describe('card ordering — showdown cards', () => {
  function stateWithShowdown(): HandState {
    let s = st()
    s = { ...s, streets: [street('Preflop', 'BTN r 15, BB c')] }
    s = beginShowdown(s)
    s = beginShowdownActor(s, 'BB')
    s = setShowdownVerb(s, 0, 'shows')
    return s
  }

  it('setShowdownCards stores higher rank first when lower rank is given first', () => {
    const result = setShowdownCards(stateWithShowdown(), 0, [C('2s'), C('As')])
    expect(result.showdown![0].cards![0]).toEqual(C('As'))
    expect(result.showdown![0].cards![1]).toEqual(C('2s'))
  })

  it('setShowdownCards preserves order when already highest rank first', () => {
    const result = setShowdownCards(stateWithShowdown(), 0, [C('As'), C('2s')])
    expect(result.showdown![0].cards![0]).toEqual(C('As'))
    expect(result.showdown![0].cards![1]).toEqual(C('2s'))
  })

  it('editShowdownCard re-sorts after a card edit changes which rank is higher', () => {
    let s = setShowdownCards(stateWithShowdown(), 0, [C('Qd'), C('Th')])
    // Edit slot 1 (Th) to As → should become AsQd
    s = editShowdownCard(s, 0, 1, C('As'))
    expect(s.showdown![0].cards![0]).toEqual(C('As'))
    expect(s.showdown![0].cards![1]).toEqual(C('Qd'))
  })

  it('showdown cards appear in highest-rank-first order in the serialized hand', () => {
    const s = setShowdownCards(stateWithShowdown(), 0, [C('2s'), C('As')])
    const serialized = serializeHand(s)
    expect(serialized).toContain('BB shows As2s')
  })

  it('showdown cards appear in highest-rank-first order in the hand view model', () => {
    const s = setShowdownCards(stateWithShowdown(), 0, [C('2s'), C('As')])
    const vm = buildHandViewModel(s)
    expect(vm.showdown![0].cards![0]).toBe('As')
    expect(vm.showdown![0].cards![1]).toBe('2s')
  })
})

// ===========================================================================
// legalVerbsForNewAction
// ===========================================================================

describe('legalVerbsForNewAction', () => {
  it('returns facing-bet verbs for a non-BB actor on an unraised preflop', () => {
    const state = st({ streets: [street('Preflop', 'UTG c, CO c')] })
    const { verbs, facingBet } = legalVerbsForNewAction(state, 'Preflop', 'BTN')
    expect(facingBet).toBe(true)
    expect(verbs).toContain('c')
    expect(verbs).not.toContain('x')
  })

  it('returns BB option verbs when BB acts without prior raise', () => {
    const state = st({ streets: [street('Preflop', 'UTG c, CO c, BTN c, SB c')] })
    const { verbs, bbOption } = legalVerbsForNewAction(state, 'Preflop', 'BB')
    expect(bbOption).toBe(true)
    expect(verbs).toContain('x')
    expect(verbs).not.toContain('c')
  })

  it('returns facing-bet verbs for BB when there was a raise', () => {
    const state = st({ streets: [street('Preflop', 'UTG r 15, CO c')] })
    const { verbs, facingBet } = legalVerbsForNewAction(state, 'Preflop', 'BB')
    expect(facingBet).toBe(true)
    expect(verbs).toContain('c')
    expect(verbs).not.toContain('x')
  })

  it('returns check/bet verbs on a postflop street with no prior bet', () => {
    const state = st({ streets: [street('Preflop', 'BTN c, BB x'), street('Flop', '')] })
    const { verbs, facingBet } = legalVerbsForNewAction(state, 'Flop', 'BB')
    expect(facingBet).toBe(false)
    expect(verbs).toContain('x')
    expect(verbs).toContain('b')
  })

  it('returns correct preflop verbs before the preflop street has been created', () => {
    const state = st({ streets: [] })
    const { verbs: btnVerbs, facingBet } = legalVerbsForNewAction(state, 'Preflop', 'BTN')
    expect(facingBet).toBe(true)
    expect(btnVerbs).toContain('c')
    expect(btnVerbs).not.toContain('x')
    expect(btnVerbs).not.toContain('b')
    const { verbs: bbVerbs, bbOption } = legalVerbsForNewAction(state, 'Preflop', 'BB')
    expect(bbOption).toBe(true)
    expect(bbVerbs).toContain('x')
    expect(bbVerbs).not.toContain('c')
    expect(bbVerbs).not.toContain('b')
  })
})

// ===========================================================================
// legalVerbsForActorAtSlot
// ===========================================================================

describe('legalVerbsForActorAtSlot', () => {
  it('returns BB option verbs when BB at slot 0 preflop with no raise', () => {
    const state = parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB x')
    const { verbs, bbOption } = legalVerbsForActorAtSlot(state, 'Preflop', 0, 'BB')
    expect(bbOption).toBe(true)
    expect(verbs).toContain('x')
  })

  it('returns facing-bet verbs when changing actor from BB to BTN at slot 0 preflop', () => {
    const state = parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB x')
    const { verbs, facingBet } = legalVerbsForActorAtSlot(state, 'Preflop', 0, 'BTN')
    expect(facingBet).toBe(true)
    expect(verbs).toContain('c')
    expect(verbs).not.toContain('x')
  })

  it('accounts for prior actions when computing verbs for slot 1', () => {
    const state = parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: UTG r 15, CO c')
    const { verbs, facingBet } = legalVerbsForActorAtSlot(state, 'Preflop', 1, 'CO')
    expect(facingBet).toBe(true)
    expect(verbs).toContain('c')
    expect(verbs).not.toContain('x')
  })
})

// ===========================================================================
// addAction
// ===========================================================================

describe('addAction', () => {
  it('atomically adds actor + verb in a single call with no trailing verbless action', () => {
    const state = st({ streets: [{ name: 'Preflop', actions: [] }] })
    const next = addAction(state, 'Preflop', 'UTG', 'r', 15)
    const actions = next.streets.find((s) => s.name === 'Preflop')!.actions
    expect(actions).toHaveLength(1)
    expect(actions[0].actor).toBe('UTG')
    expect(actions[0].verb).toBe('r')
    expect(actions[0].amount).toBe(15)
  })

  it('does not leave any verbless trailing actions', () => {
    const state = st({ streets: [{ name: 'Preflop', actions: [] }] })
    const next = addAction(state, 'Preflop', 'BTN', 'f')
    const actions = next.streets.find((s) => s.name === 'Preflop')!.actions
    expect(actions.every((a) => a.verb !== undefined)).toBe(true)
  })

  it('appends to existing actions on the street', () => {
    const state = st({ streets: [street('Preflop', 'UTG r 15')] })
    const next = addAction(state, 'Preflop', 'CO', 'c')
    const actions = next.streets.find((s) => s.name === 'Preflop')!.actions
    expect(actions).toHaveLength(2)
    expect(actions[1].actor).toBe('CO')
    expect(actions[1].verb).toBe('c')
  })

  it('omits amount when not provided', () => {
    const state = st({ streets: [{ name: 'Preflop', actions: [] }] })
    const next = addAction(state, 'Preflop', 'UTG', 'f')
    expect(next.streets[0].actions[0].amount).toBeUndefined()
  })
})

// ===========================================================================
// editAction
// ===========================================================================

describe('editAction', () => {
  it('atomically updates actor and verb on an existing action', () => {
    const state = st({ streets: [street('Preflop', 'UTG r 15, CO c')] })
    const next = editAction(state, 'Preflop', 0, 'HJ', 'r', 20)
    const actions = next.streets.find((s) => s.name === 'Preflop')!.actions
    expect(actions[0].actor).toBe('HJ')
    expect(actions[0].verb).toBe('r')
    expect(actions[0].amount).toBe(20)
  })

  it('preserves other actions in the street', () => {
    const state = st({ streets: [street('Preflop', 'UTG r 15, CO c')] })
    const next = editAction(state, 'Preflop', 0, 'HJ', 'f')
    const actions = next.streets.find((s) => s.name === 'Preflop')!.actions
    expect(actions[1]).toMatchObject({ actor: 'CO', verb: 'c' })
  })

  it('clears amount when not provided', () => {
    const state = st({ streets: [street('Preflop', 'UTG r 15')] })
    const next = editAction(state, 'Preflop', 0, 'UTG', 'f')
    expect(next.streets[0].actions[0].amount).toBeUndefined()
  })

  it('preserves the action id', () => {
    const state = st({ streets: [street('Preflop', 'UTG r 15')] })
    const originalId = state.streets[0].actions[0].id
    const next = editAction(state, 'Preflop', 0, 'CO', 'c')
    expect(next.streets[0].actions[0].id).toBe(originalId)
  })

  it('rejects a verb that is illegal for the new actor at the slot', () => {
    // Preflop unraised: BB has the option, so "call" is not legal for BB.
    const state = st({ streets: [street('Preflop', 'UTG c')] })
    expect(() => editAction(state, 'Preflop', 0, 'BB', 'c')).toThrow()
  })

  it('accepts a verb that is legal for the new actor at the slot', () => {
    const state = st({ streets: [street('Preflop', 'UTG c')] })
    const next = editAction(state, 'Preflop', 0, 'BB', 'x')
    expect(next.streets[0].actions[0]).toMatchObject({ actor: 'BB', verb: 'x' })
  })
})

// ===========================================================================
// Notes — addNote / deleteNote / anchors
// ===========================================================================

describe('availableNoteAnchors', () => {
  it('always offers the top anchor', () => {
    expect(availableNoteAnchors(st({ board: undefined, hero: undefined }))).toContain('top')
  })

  it('offers each section that exists, in timeline order', () => {
    const state = st({
      stakes: '2/5',
      streets: [street('Preflop', 'BTN r 15, BB c'), street('Flop', 'BB x, BTN x')],
      showdown: [],
    })
    expect(availableNoteAnchors(state)).toEqual([
      'top', 'stakes', 'board', 'hero', 'Preflop', 'Flop', 'showdown',
    ])
  })

  it('omits sections that are not recorded yet', () => {
    const anchors = availableNoteAnchors(st())
    expect(anchors).not.toContain('stakes')
    expect(anchors).not.toContain('Preflop')
    expect(anchors).not.toContain('showdown')
  })
})

describe('currentNoteAnchor', () => {
  it('points at the latest street with actions', () => {
    const state = st({ streets: [street('Preflop', 'BTN r 15, BB c'), street('Flop', 'BB x')] })
    expect(currentNoteAnchor(state)).toBe('Flop')
  })

  it('points at showdown once it has begun', () => {
    const state = st({ streets: [street('Preflop', 'BTN c, BB x')], showdown: [] })
    expect(currentNoteAnchor(state)).toBe('showdown')
  })
})

describe('addNote', () => {
  it('anchors to the most recently-recorded section by default', () => {
    const state = st({ streets: [street('Preflop', 'BTN r 15, BB c'), street('Flop', 'BB x')] })
    expect(addNote(state, 'flop read').notes[0].anchor).toBe('Flop')
  })

  it('uses the explicit anchor when given', () => {
    const state = st({ streets: [street('Preflop', 'BTN r 15, BB c'), street('Flop', 'BB x')] })
    expect(addNote(state, 'villain seemed weak', 'Preflop').notes[0].anchor).toBe('Preflop')
  })

  it('throws when the anchor section does not exist', () => {
    const state = st({ streets: [street('Preflop', 'BTN r 15, BB c')] })
    expect(() => addNote(state, 'late note', 'showdown')).toThrow()
  })

  it('ignores empty text', () => {
    expect(addNote(st(), '   ').notes).toHaveLength(0)
  })
})

describe('deleteNote', () => {
  it('removes the note with the given id', () => {
    const state = addNote(st(), 'a read')
    expect(deleteNote(state, state.notes[0].id).notes).toHaveLength(0)
  })

  it('leaves other notes untouched', () => {
    const state = addNote(addNote(st(), 'first'), 'second')
    const next = deleteNote(state, state.notes[0].id)
    expect(next.notes.map((n) => n.text)).toEqual(['second'])
  })

  it('is a no-op for an unknown id', () => {
    const state = addNote(st(), 'a read')
    expect(deleteNote(state, 'nope').notes).toHaveLength(1)
  })
})
