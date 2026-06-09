import { describe, it, expect } from 'vitest'
import { parseHand } from './parser'

// ---------------------------------------------------------------------------
// 1. Valid full hand (all 4 streets, stakes present)
// ---------------------------------------------------------------------------

const FULL_HAND = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: BTN r 15, BB c
Flop: BB x, BTN b 20, BB c
Turn: BB x, BTN x
River: BB b 40, BTN f`

describe('parseHand — valid full hand', () => {
  it('parses without throwing', () => {
    expect(parseHand(FULL_HAND)).toBeDefined()
  })

  it('id is a non-empty string', () => {
    const state = parseHand(FULL_HAND)
    expect(typeof state.id).toBe('string')
    expect(state.id.length).toBeGreaterThan(0)
  })

  it('stakes is the trimmed stakes text', () => {
    expect(parseHand(FULL_HAND).stakes).toBe('$2/$5')
  })

  it('board has 3 cards with correct values', () => {
    const board = parseHand(FULL_HAND).board!
    expect(board).toHaveLength(3)
    expect(board[0]).toEqual({ rank: 'A', suit: 's' })
    expect(board[1]).toEqual({ rank: '8', suit: 'h' })
    expect(board[2]).toEqual({ rank: 'T', suit: 'd' })
  })

  it('hero position is BTN', () => {
    expect(parseHand(FULL_HAND).hero!.position).toBe('BTN')
  })

  it('hero cards are correct', () => {
    const cards = parseHand(FULL_HAND).hero!.cards!
    expect(cards[0]).toEqual({ rank: 'A', suit: 'h' })
    expect(cards[1]).toEqual({ rank: 'K', suit: 's' })
  })

  it('has exactly 4 streets in order', () => {
    const streets = parseHand(FULL_HAND).streets
    expect(streets.map((s) => s.name)).toEqual(['Preflop', 'Flop', 'Turn', 'River'])
  })

  it('action counts per street are correct', () => {
    const streets = parseHand(FULL_HAND).streets
    expect(streets[0].actions).toHaveLength(2)
    expect(streets[1].actions).toHaveLength(3)
    expect(streets[2].actions).toHaveLength(2)
    expect(streets[3].actions).toHaveLength(2)
  })

  it('every action carries a unique non-empty id', () => {
    const ids = parseHand(FULL_HAND).streets.flatMap((s) => s.actions.map((a) => a.id))
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// 2. Minimal hand (no stakes, empty board, only Preflop)
// ---------------------------------------------------------------------------

const MINIMAL_HAND = `Board:
Hero: BB AhKs
Preflop: BB x`

describe('parseHand — minimal hand', () => {
  it('parses without throwing', () => {
    expect(() => parseHand(MINIMAL_HAND)).not.toThrow()
  })

  it('stakes is undefined', () => {
    expect(parseHand(MINIMAL_HAND).stakes).toBeUndefined()
  })

  it('board is empty', () => {
    expect(parseHand(MINIMAL_HAND).board).toHaveLength(0)
  })

  it('has exactly 1 Preflop street', () => {
    const streets = parseHand(MINIMAL_HAND).streets
    expect(streets).toHaveLength(1)
    expect(streets[0].name).toBe('Preflop')
  })
})

// ---------------------------------------------------------------------------
// 3 & 4. 4- and 5-card boards
// ---------------------------------------------------------------------------

describe('parseHand — board sizes', () => {
  it('parses a 4-card board', () => {
    const board = parseHand(
      'Board: As 8h Td Jc\nHero: BTN AhKs\nPreflop: BTN r 15, BB c\nFlop: BB x, BTN b 20, BB c\nTurn: BB x, BTN b 30, BB c',
    ).board!
    expect(board).toHaveLength(4)
    expect(board[3]).toEqual({ rank: 'J', suit: 'c' })
  })

  it('parses a 5-card board', () => {
    const board = parseHand(
      'Board: As 8h Td Jc 2s\nHero: BTN AhKs\nPreflop: BTN r 15, BB c\nFlop: BB x, BTN b 20, BB c\nTurn: BB x, BTN x\nRiver: BB b 40, BTN c',
    ).board!
    expect(board).toHaveLength(5)
    expect(board[4]).toEqual({ rank: '2', suit: 's' })
  })
})

// ---------------------------------------------------------------------------
// 5. All positions
// ---------------------------------------------------------------------------

const ALL_POSITIONS = ['BB', 'BTN', 'CO', 'UTG', 'SB', 'HJ', 'MP', 'EP', 'UTG+1', 'UTG+2', 'UTG+3']

describe('parseHand — positions', () => {
  for (const pos of ALL_POSITIONS) {
    it(`parses Hero position "${pos}"`, () => {
      expect(parseHand(`Board: As 8h Td\nHero: ${pos} AhKs\nPreflop: ${pos} x`).hero!.position).toBe(pos)
    })
  }

  for (const pos of ALL_POSITIONS) {
    it(`parses actor "${pos}" in an action`, () => {
      expect(parseHand(`Board: As 8h Td\nHero: BTN AhKs\nPreflop: ${pos} x`).streets[0].actions[0].actor).toBe(pos)
    })
  }
})

// ---------------------------------------------------------------------------
// 6. All verbs
// ---------------------------------------------------------------------------

describe('parseHand — verbs', () => {
  const first = (raw: string) => parseHand(raw).streets[0].actions[0]

  it('check (x) has no amount', () => {
    const a = first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN x')
    expect(a.verb).toBe('x')
    expect(a.amount).toBeUndefined()
  })

  it('call (c) has no amount', () => {
    expect(first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN c').verb).toBe('c')
  })

  it('fold (f) has no amount', () => {
    expect(first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN f').verb).toBe('f')
  })

  it('raise (r) carries amount', () => {
    const a = first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 50')
    expect(a.verb).toBe('r')
    expect(a.amount).toBe(50)
  })

  it('bet (b) carries amount', () => {
    const a = first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN b 75')
    expect(a.verb).toBe('b')
    expect(a.amount).toBe(75)
  })

  it('raise with decimal amount', () => {
    expect(first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 12.5').amount).toBe(12.5)
  })

  it('"all in" (canonical) parses to verb a', () => {
    const a = first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN all in 200')
    expect(a.verb).toBe('a')
    expect(a.amount).toBe(200)
  })

  it('legacy single "a" parses to verb a', () => {
    expect(first('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN a').verb).toBe('a')
  })
})

// ---------------------------------------------------------------------------
// 7. Notes are captured into the model (not dropped)
// ---------------------------------------------------------------------------

describe('parseHand — notes', () => {
  it('captures a note anchored to the section it follows', () => {
    const state = parseHand('Board: As 8h Td\n# my read\nHero: BTN AhKs\nPreflop: BTN x')
    expect(state.notes).toHaveLength(1)
    expect(state.notes[0].text).toBe('my read')
    expect(state.notes[0].anchor).toBe('board')
  })

  it('a note before any section anchors to "top"', () => {
    const state = parseHand('# top note\nBoard:\nHero: BTN AhKs\nPreflop: BTN x')
    expect(state.notes[0].anchor).toBe('top')
  })
})

// ---------------------------------------------------------------------------
// 8. Malformed input — throws
// ---------------------------------------------------------------------------

describe('parseHand — throws on malformed input', () => {
  it('throws on empty string', () => {
    expect(() => parseHand('')).toThrow()
  })

  it('throws on whitespace-only string', () => {
    expect(() => parseHand('   \n  ')).toThrow()
  })

  it('throws when Board line is missing', () => {
    expect(() => parseHand('Hero: BTN AhKs\nPreflop: BTN r 15')).toThrow(/Missing Board line/)
  })

  it('throws when Hero line is missing', () => {
    expect(() => parseHand('Board: As 8h Td\nPreflop: BTN r 15')).toThrow(/Missing Hero line/)
  })

  it('throws on invalid card code in Board', () => {
    expect(() => parseHand('Board: Zz 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15')).toThrow(/Invalid card code "Zz"/)
  })

  it('throws on invalid card code in Hero', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN XxKs\nPreflop: BTN r 15')).toThrow(/Invalid card code/)
  })

  it('throws on unknown verb', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN z 15')).toThrow(/Unknown verb/)
  })

  it('throws on raise with no amount', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r')).toThrow(/requires an amount/)
  })

  it('throws on bet with no amount', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN AhKs\nFlop: BTN b')).toThrow(/requires an amount/)
  })

  it('throws when no streets present', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN AhKs')).toThrow(/Missing at least one street/)
  })

  it('throws on unknown actor', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: XYZ x')).toThrow(/Unknown actor/)
  })

  it('throws on the retired generic actor H', () => {
    expect(() => parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x')).toThrow(/Unknown actor/)
  })
})

// ---------------------------------------------------------------------------
// 9. Stakes line
// ---------------------------------------------------------------------------

describe('parseHand — stakes line', () => {
  it('stakes absent when not in input', () => {
    expect(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15').stakes).toBeUndefined()
  })

  it('stakes value is trimmed', () => {
    expect(parseHand('[Stakes:  $5/$10 ]\nBoard:\nHero: BTN AhKs\nPreflop: BTN x').stakes).toBe('$5/$10')
  })
})

// ---------------------------------------------------------------------------
// 10. Fresh hand id each call
// ---------------------------------------------------------------------------

describe('parseHand — fresh id each call', () => {
  it('two calls on the same input produce different hand ids', () => {
    expect(parseHand(FULL_HAND).id).not.toBe(parseHand(FULL_HAND).id)
  })
})
