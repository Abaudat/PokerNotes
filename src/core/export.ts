import { SUIT_GLYPHS } from './cards'
import type { HandAST, Action, Card, Verb, ShowdownAction } from './types'

function cardGlyph(card: Card): string {
  return card.rank + SUIT_GLYPHS[card.suit]
}

const VERB_WORDS: Record<Verb, string> = {
  x: 'checks',
  c: 'calls',
  r: 'raises',
  f: 'folds',
  b: 'bets',
  a: 'all in',
}

function actorName(actor: string): string {
  return actor === 'H' ? 'Hero' : actor
}

function formatAction(action: Action): string {
  const actor = actorName(action.actor.value)
  const verb = VERB_WORDS[action.verb.value]
  if (action.amount !== undefined) {
    if (action.verb.value === 'a') {
      return `${actor} ${verb} ${action.amount.value} eff`
    }
    return `${actor} ${verb} $${action.amount.value}`
  }
  return `${actor} ${verb}`
}

function formatShowdownAction(action: ShowdownAction): string {
  const actor = actorName(action.actor.value)
  const verb = action.verb.value
  if (verb === 'shows' && action.cards) {
    const c1 = cardGlyph(action.cards[0].value)
    const c2 = cardGlyph(action.cards[1].value)
    return `${actor} shows ${c1} ${c2}`
  }
  return `${actor} ${verb}`
}

/**
 * Produces a human-readable export string with suit glyphs and full verb words.
 * Format matches SPEC section 8.
 */
export function formatForExport(ast: HandAST): string {
  const lines: string[] = []

  const date = new Date().toISOString().slice(0, 10)
  const stakesText = ast.stakes ? ` · ${ast.stakes.raw.value} NLH` : ''
  lines.push(`${date}${stakesText}`)

  const boardCards = ast.board.cards.map((t) => cardGlyph(t.value)).join(' ')
  lines.push(`Board: ${boardCards}`)

  const heroPos = ast.hero.position.value
  const heroCard1 = cardGlyph(ast.hero.cards[0].value)
  const heroCard2 = cardGlyph(ast.hero.cards[1].value)
  lines.push(`Hero (${heroPos}): ${heroCard1} ${heroCard2}`)

  for (const street of ast.streets) {
    const actions = street.actions.map(formatAction).join(', ')
    lines.push(`${street.name}: ${actions}`)
  }

  if (ast.showdown) {
    const sdActions = ast.showdown.actions.map(formatShowdownAction).join(', ')
    lines.push(`Showdown: ${sdActions}`)
  }

  return lines.join('\n')
}
