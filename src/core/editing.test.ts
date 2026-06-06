import { describe, it, expect } from 'vitest'
import { replaceToken } from './editing'
import { parseHand } from './parser'
import { serializeHand } from './serializer'
import type { Card, Position, Verb } from './types'

const SAMPLE_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c`

describe('replaceToken', () => {
  it('returns a new HandAST (does not mutate the original)', () => {
    const ast = parseHand(SAMPLE_RAW)
    const boardCardId = ast.board.cards[0].id
    const newCard: Card = { rank: 'Q', suit: 'd' }
    const updated = replaceToken(ast, boardCardId, newCard)
    expect(updated).not.toBe(ast)
    expect(ast.board.cards[0].value).toEqual({ rank: 'A', suit: 's' })
  })

  it('replaces a board card by id', () => {
    const ast = parseHand(SAMPLE_RAW)
    const boardCardId = ast.board.cards[0].id
    const newCard: Card = { rank: 'Q', suit: 'd' }
    const updated = replaceToken(ast, boardCardId, newCard)
    expect(updated.board.cards[0].value).toEqual(newCard)
  })

  it('replaces a Hero card by id', () => {
    const ast = parseHand(SAMPLE_RAW)
    const heroCard1Id = ast.hero.cards[0].id
    const newCard: Card = { rank: '2', suit: 'c' }
    const updated = replaceToken(ast, heroCard1Id, newCard)
    expect(updated.hero.cards[0].value).toEqual(newCard)
  })

  it('replaces Hero position by id', () => {
    const ast = parseHand(SAMPLE_RAW)
    const heroPosId = ast.hero.position.id
    const updated = replaceToken(ast, heroPosId, 'CO' as Position)
    expect(updated.hero.position.value).toBe('CO')
  })

  it('replaces an action verb by id', () => {
    const ast = parseHand(SAMPLE_RAW)
    const preflopAction = ast.streets[0].actions[0]
    const verbId = preflopAction.verb.id
    const updated = replaceToken(ast, verbId, 'b' as Verb)
    expect(updated.streets[0].actions[0].verb.value).toBe('b')
  })

  it('replaces an action amount by id', () => {
    const ast = parseHand(SAMPLE_RAW)
    const preflopAction = ast.streets[0].actions[0]
    const amountId = preflopAction.amount!.id
    const updated = replaceToken(ast, amountId, 25)
    expect(updated.streets[0].actions[0].amount?.value).toBe(25)
  })

  it('replaces an actor position by id', () => {
    const ast = parseHand(SAMPLE_RAW)
    const actorId = ast.streets[0].actions[1].actor.id
    const updated = replaceToken(ast, actorId, 'SB' as Position)
    expect(updated.streets[0].actions[1].actor.value).toBe('SB')
  })

  it('serializes correctly after replacement', () => {
    const ast = parseHand(SAMPLE_RAW)
    const boardCardId = ast.board.cards[0].id
    const newCard: Card = { rank: 'Q', suit: 'd' }
    const updated = replaceToken(ast, boardCardId, newCard)
    const serialized = serializeHand(updated)
    expect(serialized).toContain('Qd')
    expect(serialized).not.toContain('As')
  })

  it('round-trips: parse → replace → serialize → parse yields consistent AST', () => {
    const ast = parseHand(SAMPLE_RAW)
    const boardCardId = ast.board.cards[0].id
    const newCard: Card = { rank: 'K', suit: 'h' }
    const updated = replaceToken(ast, boardCardId, newCard)
    const serialized = serializeHand(updated)
    const reparsed = parseHand(serialized)
    expect(reparsed.board.cards[0].value).toEqual(newCard)
    expect(reparsed.board.cards[1].value).toEqual(ast.board.cards[1].value)
  })

  it('throws when the id is not found', () => {
    const ast = parseHand(SAMPLE_RAW)
    expect(() => replaceToken(ast, 'tok_nonexistent', 42)).toThrow()
  })

  it('stakes raw token can be replaced', () => {
    const ast = parseHand(SAMPLE_RAW)
    const stakesId = ast.stakes!.raw.id
    const updated = replaceToken(ast, stakesId, '$5/$10')
    expect(updated.stakes?.raw.value).toBe('$5/$10')
  })
})
