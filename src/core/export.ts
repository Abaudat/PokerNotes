import { SUIT_GLYPHS } from './cards'
import { computePotAtStreetStart, markerFor, markerLabel } from './engine'
import type { HandState, Action, Card, NoteAnchor, Verb, ShowdownEntry } from './types'

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

function actorName(state: HandState, actor: Action['actor']): string {
  return markerLabel(actor, markerFor(state, actor))
}

function formatAction(state: HandState, action: Action): string {
  const actor = actorName(state, action.actor)
  const verb = action.verb !== undefined ? VERB_WORDS[action.verb] : ''
  if (action.amount !== undefined) {
    if (action.verb === 'a') {
      return `${actor} ${verb} ${action.amount} eff`
    }
    return `${actor} ${verb} $${action.amount}`
  }
  return `${actor} ${verb}`
}

function formatShowdownEntry(state: HandState, entry: ShowdownEntry): string {
  const actor = actorName(state, entry.actor)
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

  // Notes follow the section their anchor names, as in the serialized form.
  const emitNotes = (anchor: NoteAnchor) => {
    for (const note of state.notes) {
      if (note.anchor === anchor) lines.push(`# ${note.text}`)
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  const stakesText = state.stakes ? ` · ${state.stakes} NLH` : ''
  lines.push(`${date}${stakesText}`)
  emitNotes('top')
  emitNotes('stakes')

  const boardCards = (state.board ?? []).map(cardGlyph).join(' ')
  lines.push(`Board: ${boardCards}`)
  emitNotes('board')

  const heroPos = state.hero?.position ?? 'H'
  const heroCards = state.hero?.cards
    ? `${cardGlyph(state.hero.cards[0])} ${cardGlyph(state.hero.cards[1])}`
    : ''
  lines.push(`Hero (${heroPos}): ${heroCards}`)
  emitNotes('hero')

  for (let i = 0; i < state.streets.length; i++) {
    const street = state.streets[i]
    const actions = street.actions.map((a) => formatAction(state, a)).join(', ')
    if (street.name === 'Preflop') {
      lines.push(`${street.name}: ${actions}`)
    } else {
      const pot = computePotAtStreetStart(state, i)
      lines.push(`${street.name} (Pot: ${pot}): ${actions}`)
    }
    emitNotes(street.name)
  }

  if (state.showdown) {
    const pot = computePotAtStreetStart(state, state.streets.length)
    const sd = state.showdown.map((e) => formatShowdownEntry(state, e)).join(', ')
    lines.push(`Showdown (Pot: ${pot}): ${sd}`)
    emitNotes('showdown')
  }

  return lines.join('\n')
}
