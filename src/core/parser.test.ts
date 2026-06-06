import { describe, it, expect } from 'vitest'
import { parseHand } from './parser'
import type { HandAST, Token } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that every Token-shaped object in the AST has a non-empty id and
 *  a span where start < end. */
function collectTokens(ast: HandAST): Token<unknown>[] {
  const tokens: Token<unknown>[] = []

  if (ast.stakes) tokens.push(ast.stakes.raw)

  tokens.push(...ast.board.cards)

  tokens.push(ast.hero.position)
  tokens.push(...ast.hero.cards)

  for (const street of ast.streets) {
    for (const action of street.actions) {
      tokens.push(action.actor)
      tokens.push(action.verb)
      if (action.amount !== undefined) tokens.push(action.amount)
    }
  }

  return tokens
}

// ---------------------------------------------------------------------------
// 1. Valid full hand (all 4 streets, stakes present)
// ---------------------------------------------------------------------------

const FULL_HAND = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

describe('parseHand — valid full hand', () => {
  let ast: HandAST

  it('parses without throwing', () => {
    ast = parseHand(FULL_HAND)
    expect(ast).toBeDefined()
  })

  it('ast.raw equals the original input', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.raw).toBe(FULL_HAND)
  })

  it('ast.id is a non-empty string', () => {
    ast = parseHand(FULL_HAND)
    expect(typeof ast.id).toBe('string')
    expect(ast.id.length).toBeGreaterThan(0)
  })

  it('stakes is present and contains the stakes text', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.stakes).toBeDefined()
    expect(ast.stakes!.raw.value).toBe('$2/$5')
  })

  it('board has 3 cards', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.board.cards).toHaveLength(3)
  })

  it('board card values are correct', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.board.cards[0].value).toEqual({ rank: 'A', suit: 's' })
    expect(ast.board.cards[1].value).toEqual({ rank: '8', suit: 'h' })
    expect(ast.board.cards[2].value).toEqual({ rank: 'T', suit: 'd' })
  })

  it('hero position is BTN', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.hero.position.value).toBe('BTN')
  })

  it('hero has 2 cards', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.hero.cards).toHaveLength(2)
  })

  it('hero card values are correct', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.hero.cards[0].value).toEqual({ rank: 'A', suit: 'h' })
    expect(ast.hero.cards[1].value).toEqual({ rank: 'K', suit: 's' })
  })

  it('has exactly 4 streets', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.streets).toHaveLength(4)
  })

  it('street names are correct', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.streets[0].name).toBe('Preflop')
    expect(ast.streets[1].name).toBe('Flop')
    expect(ast.streets[2].name).toBe('Turn')
    expect(ast.streets[3].name).toBe('River')
  })

  it('action counts per street are correct', () => {
    ast = parseHand(FULL_HAND)
    expect(ast.streets[0].actions).toHaveLength(2) // Preflop: H r 15, BB c
    expect(ast.streets[1].actions).toHaveLength(3) // Flop: BB x, H b 20, BB c
    expect(ast.streets[2].actions).toHaveLength(2) // Turn: BB x, H x
    expect(ast.streets[3].actions).toHaveLength(2) // River: BB b 40, H f
  })

  it('every token has a non-empty id string', () => {
    ast = parseHand(FULL_HAND)
    for (const tok of collectTokens(ast)) {
      expect(typeof tok.id).toBe('string')
      expect(tok.id.length).toBeGreaterThan(0)
    }
  })

  it('every token has a span with start < end', () => {
    ast = parseHand(FULL_HAND)
    for (const tok of collectTokens(ast)) {
      expect(tok.span.start).toBeLessThan(tok.span.end)
    }
  })

  it('all token ids are unique', () => {
    ast = parseHand(FULL_HAND)
    const ids = collectTokens(ast).map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// 2. Valid minimal hand (no stakes, empty board, only Preflop)
// ---------------------------------------------------------------------------

const MINIMAL_HAND = `Board:
Hero: BB AhKs
Preflop: BB x`

describe('parseHand — minimal hand (no stakes, empty board)', () => {
  it('parses without throwing', () => {
    expect(() => parseHand(MINIMAL_HAND)).not.toThrow()
  })

  it('ast.stakes is undefined', () => {
    const ast = parseHand(MINIMAL_HAND)
    expect(ast.stakes).toBeUndefined()
  })

  it('board.cards is empty', () => {
    const ast = parseHand(MINIMAL_HAND)
    expect(ast.board.cards).toHaveLength(0)
  })

  it('has exactly 1 street', () => {
    const ast = parseHand(MINIMAL_HAND)
    expect(ast.streets).toHaveLength(1)
    expect(ast.streets[0].name).toBe('Preflop')
  })
})

// ---------------------------------------------------------------------------
// 3. 4-card board (turn present)
// ---------------------------------------------------------------------------

const FOUR_CARD_HAND = `Board: As 8h Td Jc
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H b 30, BB c`

describe('parseHand — 4-card board', () => {
  it('board has 4 cards', () => {
    const ast = parseHand(FOUR_CARD_HAND)
    expect(ast.board.cards).toHaveLength(4)
    expect(ast.board.cards[3].value).toEqual({ rank: 'J', suit: 'c' })
  })
})

// ---------------------------------------------------------------------------
// 4. 5-card board (river present)
// ---------------------------------------------------------------------------

const FIVE_CARD_HAND = `Board: As 8h Td Jc 2s
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H c`

describe('parseHand — 5-card board', () => {
  it('board has 5 cards', () => {
    const ast = parseHand(FIVE_CARD_HAND)
    expect(ast.board.cards).toHaveLength(5)
    expect(ast.board.cards[4].value).toEqual({ rank: '2', suit: 's' })
  })
})

// ---------------------------------------------------------------------------
// 5. All positions
// ---------------------------------------------------------------------------

describe('parseHand — all positions as Hero', () => {
  const positions = ['H', 'BB', 'BTN', 'CO', 'UTG', 'SB', 'HJ', 'MP', 'EP', 'V', 'V2', 'V3', 'UTG+1', 'UTG+2']

  for (const pos of positions) {
    it(`parses Hero position "${pos}"`, () => {
      const raw = `Board: As 8h Td\nHero: ${pos} AhKs\nPreflop: ${pos} x`
      const ast = parseHand(raw)
      expect(ast.hero.position.value).toBe(pos)
    })
  }
})

describe('parseHand — all positions as action actor', () => {
  const positions = ['H', 'BB', 'BTN', 'CO', 'UTG', 'SB', 'HJ', 'MP', 'EP', 'V', 'V2', 'V3', 'UTG+1', 'UTG+2']

  for (const pos of positions) {
    it(`parses actor "${pos}" in an action`, () => {
      const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: ${pos} x`
      const ast = parseHand(raw)
      expect(ast.streets[0].actions[0].actor.value).toBe(pos)
    })
  }
})

// ---------------------------------------------------------------------------
// 6. All verbs
// ---------------------------------------------------------------------------

describe('parseHand — all verbs', () => {
  it('verb x (check) — no amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H x`
    const ast = parseHand(raw)
    const action = ast.streets[0].actions[0]
    expect(action.verb.value).toBe('x')
    expect(action.amount).toBeUndefined()
  })

  it('verb c (call) — no amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H c`
    const ast = parseHand(raw)
    const action = ast.streets[0].actions[0]
    expect(action.verb.value).toBe('c')
    expect(action.amount).toBeUndefined()
  })

  it('verb f (fold) — no amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H f`
    const ast = parseHand(raw)
    const action = ast.streets[0].actions[0]
    expect(action.verb.value).toBe('f')
    expect(action.amount).toBeUndefined()
  })

  it('verb r (raise) — with amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H r 50`
    const ast = parseHand(raw)
    const action = ast.streets[0].actions[0]
    expect(action.verb.value).toBe('r')
    expect(action.amount).toBeDefined()
    expect(action.amount!.value).toBe(50)
  })

  it('verb b (bet) — with amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H b 75`
    const ast = parseHand(raw)
    const action = ast.streets[0].actions[0]
    expect(action.verb.value).toBe('b')
    expect(action.amount).toBeDefined()
    expect(action.amount!.value).toBe(75)
  })

  it('verb r with decimal amount', () => {
    const raw = `Board: As 8h Td\nHero: H AhKs\nPreflop: H r 12.5`
    const ast = parseHand(raw)
    expect(ast.streets[0].actions[0].amount!.value).toBe(12.5)
  })
})

// ---------------------------------------------------------------------------
// 7. Span correctness
// ---------------------------------------------------------------------------

describe('parseHand — span correctness', () => {
  const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c`

  it('card token span slices back to card text', () => {
    const ast = parseHand(raw)
    for (const cardTok of ast.board.cards) {
      const sliced = raw.slice(cardTok.span.start, cardTok.span.end)
      expect(sliced).toBe(
        cardTok.value.rank + cardTok.value.suit,
      )
    }
  })

  it('hero card spans slice back correctly', () => {
    const ast = parseHand(raw)
    for (const cardTok of ast.hero.cards) {
      const sliced = raw.slice(cardTok.span.start, cardTok.span.end)
      expect(sliced).toBe(cardTok.value.rank + cardTok.value.suit)
    }
  })

  it('position token span slices back to position text', () => {
    const ast = parseHand(raw)
    const posTok = ast.hero.position
    expect(raw.slice(posTok.span.start, posTok.span.end)).toBe(posTok.value)
  })

  it('verb token span slices back to verb text', () => {
    const ast = parseHand(raw)
    const verbTok = ast.streets[0].actions[0].verb
    expect(raw.slice(verbTok.span.start, verbTok.span.end)).toBe(verbTok.value)
  })

  it('amount token span slices back to amount text', () => {
    const ast = parseHand(raw)
    const amtTok = ast.streets[0].actions[0].amount!
    expect(raw.slice(amtTok.span.start, amtTok.span.end)).toBe('15')
  })

  it('actor token span slices back to actor text', () => {
    const ast = parseHand(raw)
    const actorTok = ast.streets[0].actions[0].actor
    expect(raw.slice(actorTok.span.start, actorTok.span.end)).toBe(actorTok.value)
  })

  it('BB actor span slices back to "BB"', () => {
    const ast = parseHand(raw)
    const bbActor = ast.streets[0].actions[1].actor
    expect(raw.slice(bbActor.span.start, bbActor.span.end)).toBe('BB')
  })
})

// ---------------------------------------------------------------------------
// Span correctness with stakes
// ---------------------------------------------------------------------------

describe('parseHand — stakes span correctness', () => {
  it('stakes raw token span slices back to the stakes text', () => {
    const raw = `[Stakes: $2/$5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15`
    const ast = parseHand(raw)
    expect(ast.stakes).toBeDefined()
    const stakesTok = ast.stakes!.raw
    const sliced = raw.slice(stakesTok.span.start, stakesTok.span.end)
    expect(sliced).toBe('$2/$5')
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
    const raw = `Hero: BTN AhKs\nPreflop: H r 15`
    expect(() => parseHand(raw)).toThrow(/Missing Board line/)
  })

  it('throws when Hero line is missing', () => {
    const raw = `Board: As 8h Td\nPreflop: H r 15`
    expect(() => parseHand(raw)).toThrow(/Missing Hero line/)
  })

  it('throws on invalid card code in Board', () => {
    const raw = `Board: Zz 8h Td\nHero: BTN AhKs\nPreflop: H r 15`
    expect(() => parseHand(raw)).toThrow(/Invalid card code "Zz"/)
  })

  it('throws on invalid card code in Hero', () => {
    const raw = `Board: As 8h Td\nHero: BTN XxKs\nPreflop: H r 15`
    expect(() => parseHand(raw)).toThrow(/Invalid card code/)
  })

  it('throws on unknown verb in action', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H z 15`
    expect(() => parseHand(raw)).toThrow(/Unknown verb/)
  })

  it('throws on raise with no amount', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r`
    expect(() => parseHand(raw)).toThrow(/requires an amount/)
  })

  it('throws on bet with no amount', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nFlop: H b`
    expect(() => parseHand(raw)).toThrow(/requires an amount/)
  })

  it('throws when no streets present', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs`
    expect(() => parseHand(raw)).toThrow(/Missing at least one street/)
  })

  it('throws on unknown actor in action', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: XYZ x`
    expect(() => parseHand(raw)).toThrow(/Unknown actor/)
  })
})

// ---------------------------------------------------------------------------
// 9. Stakes line — optional; present; value
// ---------------------------------------------------------------------------

describe('parseHand — stakes line', () => {
  it('stakes absent when not in input', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15`
    const ast = parseHand(raw)
    expect(ast.stakes).toBeUndefined()
  })

  it('stakes present when line is given', () => {
    const raw = `[Stakes: $1/$2]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15`
    const ast = parseHand(raw)
    expect(ast.stakes).toBeDefined()
  })

  it('stakes raw value contains the stakes text', () => {
    const raw = `[Stakes: $1/$2]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15`
    const ast = parseHand(raw)
    expect(ast.stakes!.raw.value).toBe('$1/$2')
  })

  it('stakes raw value is correctly trimmed', () => {
    const raw = `[Stakes:  $5/$10 ]\nBoard:\nHero: H AhKs\nPreflop: H x`
    const ast = parseHand(raw)
    expect(ast.stakes!.raw.value).toBe('$5/$10')
  })
})

// ---------------------------------------------------------------------------
// 10. Two consecutive parses produce different hand ids but same structure
// ---------------------------------------------------------------------------

describe('parseHand — stable within one call, fresh id each call', () => {
  it('two calls on the same input produce different hand ids', () => {
    const ast1 = parseHand(FULL_HAND)
    const ast2 = parseHand(FULL_HAND)
    expect(ast1.id).not.toBe(ast2.id)
  })

  it('token ids reset between calls (first token same counter base)', () => {
    const ast1 = parseHand(FULL_HAND)
    const ast2 = parseHand(FULL_HAND)
    // Both first tokens should be "tok_1"
    const firstId1 = ast1.stakes!.raw.id
    const firstId2 = ast2.stakes!.raw.id
    expect(firstId1).toBe(firstId2)
  })
})
