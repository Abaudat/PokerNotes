import { SUIT_GLYPHS } from './cards'
import type { HandState, Action, Card, Verb, ShowdownEntry } from './types'

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
  const actor = actorName(action.actor)
  const verb = action.verb !== undefined ? VERB_WORDS[action.verb] : ''
  if (action.amount !== undefined) {
    if (action.verb === 'a') {
      return `${actor} ${verb} ${action.amount} eff`
    }
    return `${actor} ${verb} $${action.amount}`
  }
  return `${actor} ${verb}`
}

function formatShowdownEntry(entry: ShowdownEntry): string {
  const actor = actorName(entry.actor)
  if (entry.verb === 'shows' && entry.cards) {
    return `${actor} shows ${cardGlyph(entry.cards[0])} ${cardGlyph(entry.cards[1])}`
  }
  return `${actor} ${entry.verb ?? ''}`
}

/**
 * Produces a human-readable export string with suit glyphs and full verb words.
 */
export function formatForExport(state: HandState): string {
  const lines: string[] = []

  const date = new Date().toISOString().slice(0, 10)
  const stakesText = state.stakes ? ` · ${state.stakes} NLH` : ''
  lines.push(`${date}${stakesText}`)

  const boardCards = (state.board ?? []).map(cardGlyph).join(' ')
  lines.push(`Board: ${boardCards}`)

  const heroPos = state.hero?.position ?? 'H'
  const heroCards = state.hero?.cards
    ? `${cardGlyph(state.hero.cards[0])} ${cardGlyph(state.hero.cards[1])}`
    : ''
  lines.push(`Hero (${heroPos}): ${heroCards}`)

  for (const street of state.streets) {
    const actions = street.actions.map(formatAction).join(', ')
    lines.push(`${street.name}: ${actions}`)
  }

  if (state.showdown) {
    const sd = state.showdown.map(formatShowdownEntry).join(', ')
    lines.push(`Showdown: ${sd}`)
  }

  return lines.join('\n')
}
