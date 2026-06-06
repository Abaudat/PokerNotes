import { describe, it, expect } from 'vitest'
import { serializeHand } from './serializer'
import { parseHand } from './parser'
import type { HandAST, Street, Action } from './types'

// ---------------------------------------------------------------------------
// Helpers — structural comparison ignoring token ids and spans
// ---------------------------------------------------------------------------

type ActionShape = { actor: string; verb: string; amount?: number }
type StreetShape = { name: string; actions: ActionShape[] }

function extractActionShape(a: Action): ActionShape {
  const shape: ActionShape = { actor: a.actor.value, verb: a.verb.value }
  if (a.amount !== undefined) shape.amount = a.amount.value
  return shape
}

function extractStreetShape(s: Street): StreetShape {
  return {
    name: s.name,
    actions: s.actions.map(extractActionShape),
  }
}

interface ASTShape {
  stakes?: string
  boardCards: string[]
  heroPosition: string
  heroCards: [string, string]
  streets: StreetShape[]
}

function extractShape(ast: HandAST): ASTShape {
  return {
    stakes: ast.stakes?.raw.value,
    boardCards: ast.board.cards.map((t) => t.value.rank + t.value.suit),
    heroPosition: ast.hero.position.value,
    heroCards: [
      ast.hero.cards[0].value.rank + ast.hero.cards[0].value.suit,
      ast.hero.cards[1].value.rank + ast.hero.cards[1].value.suit,
    ],
    streets: ast.streets.map(extractStreetShape),
  }
}

// ---------------------------------------------------------------------------
// 1. Basic serialization — known AST → expected string
// ---------------------------------------------------------------------------

const FULL_HAND_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

describe('serializeHand — basic serialization', () => {
  it('produces the exact expected string for the full hand', () => {
    const ast = parseHand(FULL_HAND_RAW)
    const result = serializeHand(ast)
    expect(result).toBe(FULL_HAND_RAW)
  })

  it('output lines match the expected line-by-line', () => {
    const ast = parseHand(FULL_HAND_RAW)
    const lines = serializeHand(ast).split('\n')
    expect(lines[0]).toBe('[Stakes: $2/$5]')
    expect(lines[1]).toBe('Board: As 8h Td')
    expect(lines[2]).toBe('Hero: BTN AhKs')
    expect(lines[3]).toBe('Preflop: H r 15, BB c')
    expect(lines[4]).toBe('Flop: BB x, H b 20, BB c')
    expect(lines[5]).toBe('Turn: BB x, H x')
    expect(lines[6]).toBe('River: BB b 40, H f')
  })
})

// ---------------------------------------------------------------------------
// 2. No stakes → no Stakes line in output
// ---------------------------------------------------------------------------

describe('serializeHand — no stakes', () => {
  it('omits the Stakes line when ast.stakes is absent', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c`
    const ast = parseHand(raw)
    const result = serializeHand(ast)
    expect(result).not.toContain('[Stakes:')
    const lines = result.split('\n')
    expect(lines[0]).toBe('Board: As 8h Td')
  })

  it('output starts with Board line when no stakes', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB x`
    const ast = parseHand(raw)
    expect(serializeHand(ast).startsWith('Board:')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Stakes present → Stakes line first
// ---------------------------------------------------------------------------

describe('serializeHand — stakes present', () => {
  it('Stakes line appears first', () => {
    const raw = `[Stakes: $1/$2]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15`
    const ast = parseHand(raw)
    const lines = serializeHand(ast).split('\n')
    expect(lines[0]).toBe('[Stakes: $1/$2]')
  })

  it('Stakes value is the trimmed text inside brackets', () => {
    const raw = `[Stakes: $5/$10]\nBoard:\nHero: H AhKs\nPreflop: H x`
    const ast = parseHand(raw)
    const lines = serializeHand(ast).split('\n')
    expect(lines[0]).toBe('[Stakes: $5/$10]')
  })
})

// ---------------------------------------------------------------------------
// 4. Empty board → Board: line with no cards
// ---------------------------------------------------------------------------

describe('serializeHand — empty board', () => {
  it('emits Board: line when board has no cards', () => {
    const raw = `Board:\nHero: BB AhKs\nPreflop: BB f`
    const ast = parseHand(raw)
    const result = serializeHand(ast)
    const boardLine = result.split('\n').find((l) => l.startsWith('Board:'))!
    expect(boardLine).toBeDefined()
    // After the colon there should be no card text (just optional trailing space)
    expect(boardLine.replace('Board:', '').trim()).toBe('')
  })

  it('Board line is present even for a fold-preflop hand', () => {
    const raw = `Board:\nHero: CO AhKs\nPreflop: CO f`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('Board:')
  })
})

// ---------------------------------------------------------------------------
// 5. All verbs — check, call, raise (with amount), fold, bet (with amount)
// ---------------------------------------------------------------------------

describe('serializeHand — all verbs', () => {
  it('serializes check (x) without an amount', () => {
    const raw = `Board:\nHero: H AhKs\nPreflop: H x`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('H x')
  })

  it('serializes call (c) without an amount', () => {
    const raw = `Board:\nHero: H AhKs\nPreflop: H c`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('H c')
  })

  it('serializes fold (f) without an amount', () => {
    const raw = `Board:\nHero: H AhKs\nPreflop: H f`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('H f')
  })

  it('serializes raise (r) with amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H r 50`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('H r 50')
  })

  it('serializes bet (b) with amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nFlop: H b 75`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('H b 75')
  })

  it('serializes raise with decimal amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H r 12.5`
    const ast = parseHand(raw)
    expect(serializeHand(ast)).toContain('H r 12.5')
  })
})

// ---------------------------------------------------------------------------
// 6. All street names (Preflop through River)
// ---------------------------------------------------------------------------

describe('serializeHand — all street names', () => {
  const FOUR_STREET_RAW = `Board: As 8h Td Jc 2s
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

  it('includes Preflop street', () => {
    const ast = parseHand(FOUR_STREET_RAW)
    expect(serializeHand(ast)).toContain('Preflop:')
  })

  it('includes Flop street', () => {
    const ast = parseHand(FOUR_STREET_RAW)
    expect(serializeHand(ast)).toContain('Flop:')
  })

  it('includes Turn street', () => {
    const ast = parseHand(FOUR_STREET_RAW)
    expect(serializeHand(ast)).toContain('Turn:')
  })

  it('includes River street', () => {
    const ast = parseHand(FOUR_STREET_RAW)
    expect(serializeHand(ast)).toContain('River:')
  })

  it('street lines appear in correct order', () => {
    const ast = parseHand(FOUR_STREET_RAW)
    const lines = serializeHand(ast).split('\n')
    const streetLines = lines.filter((l) =>
      ['Preflop:', 'Flop:', 'Turn:', 'River:'].some((name) => l.startsWith(name)),
    )
    expect(streetLines[0]).toMatch(/^Preflop:/)
    expect(streetLines[1]).toMatch(/^Flop:/)
    expect(streetLines[2]).toMatch(/^Turn:/)
    expect(streetLines[3]).toMatch(/^River:/)
  })
})

// ===========================================================================
// Round-trip invariant tests
// ===========================================================================

// ---------------------------------------------------------------------------
// Invariant 1: parse(serialize(ast)) ≡ ast  (structural equality)
// ---------------------------------------------------------------------------

describe('round-trip invariant 1: parse(serialize(ast)) ≡ ast', () => {
  it('minimal hand: no stakes, empty board, one street', () => {
    const raw = `Board:\nHero: BB AhKs\nPreflop: BB x`
    const original = parseHand(raw)
    const roundTripped = parseHand(serializeHand(original))
    expect(extractShape(roundTripped)).toEqual(extractShape(original))
  })

  it('full hand: all 4 streets, stakes, 5-card board', () => {
    const raw = `[Stakes: $2/$5]
Board: As 8h Td Jc 2s
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`
    const original = parseHand(raw)
    const roundTripped = parseHand(serializeHand(original))
    expect(extractShape(roundTripped)).toEqual(extractShape(original))
  })

  it('hand with multiple villains (V, V2)', () => {
    const raw = `Board: As 8h Td
Hero: BTN AhKs
Preflop: V r 10, V2 c, H r 30, V f, V2 c
Flop: V2 x, H b 25, V2 c`
    const original = parseHand(raw)
    const roundTripped = parseHand(serializeHand(original))
    expect(extractShape(roundTripped)).toEqual(extractShape(original))
  })
})

// ---------------------------------------------------------------------------
// Invariant 2: serialize(parse(serialize(parse(raw)))) === serialize(parse(raw))
//   i.e. serialization is idempotent after the first pass
// ---------------------------------------------------------------------------

describe('round-trip invariant 2: serialize is idempotent after first pass', () => {
  it('full hand with all streets and stakes', () => {
    const raw = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`
    const firstPass = serializeHand(parseHand(raw))
    const secondPass = serializeHand(parseHand(firstPass))
    expect(secondPass).toBe(firstPass)
  })

  it('minimal hand without stakes', () => {
    const raw = `Board: As 8h Td\nHero: CO AhKs\nPreflop: CO r 12, BB f`
    const firstPass = serializeHand(parseHand(raw))
    const secondPass = serializeHand(parseHand(firstPass))
    expect(secondPass).toBe(firstPass)
  })
})
