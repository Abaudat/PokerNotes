import { describe, it, expect } from 'vitest'
import { serializeHand } from './serializer'
import { parseHand } from './parser'
import type { HandState, Street, Action } from './types'

// ---------------------------------------------------------------------------
// Structural comparison ignoring node ids
// ---------------------------------------------------------------------------

type ActionShape = { actor: string; verb?: string; amount?: number }
type StreetShape = { name: string; actions: ActionShape[] }

function actionShape(a: Action): ActionShape {
  const shape: ActionShape = { actor: a.actor, verb: a.verb }
  if (a.amount !== undefined) shape.amount = a.amount
  return shape
}

function streetShape(s: Street): StreetShape {
  return { name: s.name, actions: s.actions.map(actionShape) }
}

function shape(state: HandState) {
  return {
    stakes: state.stakes,
    board: (state.board ?? []).map((c) => c.rank + c.suit),
    heroPosition: state.hero?.position,
    heroCards: (state.hero?.cards ?? []).map((c) => c.rank + c.suit),
    streets: state.streets.map(streetShape),
    notes: state.notes.map((n) => ({ text: n.text, anchor: n.anchor })),
  }
}

// ---------------------------------------------------------------------------
// Basic serialization
// ---------------------------------------------------------------------------

const FULL_HAND_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: BTN r 15, BB c
Flop: BB x, BTN b 20, BB c
Turn: BB x, BTN x
River: BB b 40, BTN f`

describe('serializeHand — basic', () => {
  it('produces the exact expected string for the full hand', () => {
    expect(serializeHand(parseHand(FULL_HAND_RAW))).toBe(FULL_HAND_RAW)
  })

  it('omits the Stakes line when stakes absent', () => {
    const result = serializeHand(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15, BB c'))
    expect(result).not.toContain('[Stakes:')
    expect(result.split('\n')[0]).toBe('Board: As 8h Td')
  })

  it('Stakes line appears first when present', () => {
    const result = serializeHand(parseHand('[Stakes: $1/$2]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15'))
    expect(result.split('\n')[0]).toBe('[Stakes: $1/$2]')
  })

  it('emits a Board: line even when the board is empty', () => {
    const result = serializeHand(parseHand('Board:\nHero: BB AhKs\nPreflop: BB f'))
    const boardLine = result.split('\n').find((l) => l.startsWith('Board:'))!
    expect(boardLine.replace('Board:', '').trim()).toBe('')
  })

  it('serializes "all in" canonically (verb a → "all in")', () => {
    const result = serializeHand(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN all in 200'))
    expect(result).toContain('BTN all in 200')
  })

  it('throws when the state is incomplete', () => {
    expect(() => serializeHand({ id: 'x', streets: [], notes: [] })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Round-trip invariant: parse(serialize(state)) ≡ state (ignoring ids)
// ---------------------------------------------------------------------------

describe('round-trip: parse(serialize(state)) ≡ state', () => {
  const cases: Record<string, string> = {
    'minimal hand': 'Board:\nHero: BB AhKs\nPreflop: BB x',
    'full hand with 5-card board': `[Stakes: $2/$5]
Board: As 8h Td Jc 2s
Hero: BTN AhKs
Preflop: BTN r 15, BB c
Flop: BB x, BTN b 20, BB c
Turn: BB x, BTN x
River: BB b 40, BTN f`,
    'multiway pot': `Board: As 8h Td
Hero: BTN AhKs
Preflop: SB r 10, CO c, BTN r 30, SB f, CO c
Flop: CO x, BTN b 25, CO c`,
    'with showdown': `Board: As 8h Td
Hero: BTN AhKs
Preflop: BTN c, BB x
Showdown: BB wins`,
  }

  for (const [name, raw] of Object.entries(cases)) {
    it(name, () => {
      const original = parseHand(raw)
      const roundTripped = parseHand(serializeHand(original))
      expect(shape(roundTripped)).toEqual(shape(original))
    })
  }
})

// ---------------------------------------------------------------------------
// Notes survive a round-trip
// ---------------------------------------------------------------------------

describe('round-trip: notes are preserved', () => {
  it('re-emits a note at its anchored section', () => {
    const raw = 'Board: As 8h Td\n# hero looks weak\nHero: BTN AhKs\nPreflop: BTN x'
    const state = parseHand(raw)
    const serialized = serializeHand(state)
    expect(serialized).toContain('# hero looks weak')
    expect(shape(parseHand(serialized)).notes).toEqual(shape(state).notes)
  })
})

// ---------------------------------------------------------------------------
// Idempotence after first pass
// ---------------------------------------------------------------------------

describe('serialize is idempotent after the first pass', () => {
  it('full hand with all streets and stakes', () => {
    const first = serializeHand(parseHand(FULL_HAND_RAW))
    expect(serializeHand(parseHand(first))).toBe(first)
  })
})
