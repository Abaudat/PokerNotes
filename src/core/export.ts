import { SUIT_GLYPHS } from './cards'
import type { HandAST, Action, Card, Verb } from './types'

function cardGlyph(card: Card): string {
  return card.rank + SUIT_GLYPHS[card.suit]
}

const VERB_WORDS: Record<Verb, string> = {
  x: 'checks',
  c: 'calls',
  r: 'raises',
  f: 'folds',
  b: 'bets',
}

function actorName(actor: string): string {
  return actor === 'H' ? 'Hero' : actor
}

function formatAction(action: Action): string {
  const actor = actorName(action.actor.value)
  const verb = VERB_WORDS[action.verb.value]
  if (action.amount !== undefined) {
    return `${actor} ${verb} $${action.amount.value}`
  }
  return `${actor} ${verb}`
}

/**
 * Produces a human-readable export string with suit glyphs and full verb words.
 * Format matches SPEC section 8.
 */
export function formatForExport(ast: HandAST): string {
  const lines: string[] = []

  // Header line: date · stakes
  const date = new Date().toISOString().slice(0, 10)
  const stakesText = ast.stakes ? ` · ${ast.stakes.raw.value} NLH` : ''
  lines.push(`${date}${stakesText}`)

  // Board
  const boardCards = ast.board.cards.map((t) => cardGlyph(t.value)).join(' ')
  lines.push(`Board: ${boardCards}`)

  // Hero
  const heroPos = ast.hero.position.value
  const heroCard1 = cardGlyph(ast.hero.cards[0].value)
  const heroCard2 = cardGlyph(ast.hero.cards[1].value)
  lines.push(`Hero (${heroPos}): ${heroCard1} ${heroCard2}`)

  // Streets
  for (const street of ast.streets) {
    const actions = street.actions.map(formatAction).join(', ')
    lines.push(`${street.name}: ${actions}`)
  }

  return lines.join('\n')
}
