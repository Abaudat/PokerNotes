import { parseHand } from './parser'
import { serializeHand } from './serializer'
import type { HandAST, Token, Action, Street } from './types'

function updateToken<T>(token: Token<T>, id: string, newValue: unknown): Token<T> {
  if (token.id === id) {
    return { ...token, value: newValue as T }
  }
  return token
}

function updateAction(action: Action, id: string, newValue: unknown): { action: Action; found: boolean } {
  let found = false
  let result = action

  const newActor = updateToken(action.actor, id, newValue)
  if (newActor !== action.actor) { found = true; result = { ...result, actor: newActor } }

  const newVerb = updateToken(action.verb, id, newValue)
  if (newVerb !== action.verb) { found = true; result = { ...result, verb: newVerb } }

  if (action.amount !== undefined) {
    const newAmount = updateToken(action.amount, id, newValue)
    if (newAmount !== action.amount) { found = true; result = { ...result, amount: newAmount } }
  }

  return { action: result, found }
}

function updateStreet(street: Street, id: string, newValue: unknown): { street: Street; found: boolean } {
  let found = false
  const actions = street.actions.map((a) => {
    const r = updateAction(a, id, newValue)
    if (r.found) found = true
    return r.action
  })
  return { street: { ...street, actions }, found }
}

/**
 * Replace the token with the given id in the AST with a new value.
 * Returns a new HandAST; the original is not mutated.
 * After replacing, re-serializes and re-parses so spans and raw are consistent.
 * Throws if no token with the given id is found.
 */
export function replaceToken(ast: HandAST, id: string, newValue: unknown): HandAST {
  let found = false
  let updated: HandAST = ast

  // Stakes
  if (ast.stakes !== undefined) {
    const newRaw = updateToken(ast.stakes.raw, id, newValue)
    if (newRaw !== ast.stakes.raw) {
      found = true
      updated = { ...updated, stakes: { raw: newRaw } }
    }
  }

  // Board cards
  const newBoardCards = ast.board.cards.map((t) => {
    const r = updateToken(t, id, newValue)
    if (r !== t) found = true
    return r
  })
  if (newBoardCards.some((t, i) => t !== ast.board.cards[i])) {
    updated = { ...updated, board: { cards: newBoardCards } }
  }

  // Hero position
  const newHeroPos = updateToken(ast.hero.position, id, newValue)
  if (newHeroPos !== ast.hero.position) {
    found = true
    updated = { ...updated, hero: { ...updated.hero, position: newHeroPos } }
  }

  // Hero cards
  const newHeroCard0 = updateToken(ast.hero.cards[0], id, newValue)
  const newHeroCard1 = updateToken(ast.hero.cards[1], id, newValue)
  if (newHeroCard0 !== ast.hero.cards[0] || newHeroCard1 !== ast.hero.cards[1]) {
    found = true
    updated = {
      ...updated,
      hero: { ...updated.hero, cards: [newHeroCard0, newHeroCard1] },
    }
  }

  // Streets
  const newStreets = ast.streets.map((s) => {
    const r = updateStreet(s, id, newValue)
    if (r.found) found = true
    return r.street
  })
  if (newStreets.some((s, i) => s !== ast.streets[i])) {
    updated = { ...updated, streets: newStreets }
  }

  if (!found) {
    throw new Error(`Token with id "${id}" not found in AST`)
  }

  // Re-serialize then re-parse to rebuild consistent spans and raw
  const newRaw = serializeHand(updated)
  return parseHand(newRaw)
}
