import { formatCard } from './cards'
import type { HandState, Street, Action, ShowdownEntry, NoteAnchor } from './types'

function serializeAction(action: Action): string {
  if (action.verb === undefined) {
    throw new Error(`Cannot serialize incomplete action for "${action.actor}" (no verb)`)
  }
  const verbText = action.verb === 'a' ? 'all in' : action.verb
  if (action.amount !== undefined) {
    return `${action.actor} ${verbText} ${action.amount}`
  }
  return `${action.actor} ${verbText}`
}

function serializeStreet(street: Street): string {
  return `${street.name}: ${street.actions.map(serializeAction).join(', ')}`
}

function serializeShowdownEntry(entry: ShowdownEntry): string {
  if (entry.verb === undefined) {
    throw new Error(`Cannot serialize incomplete showdown entry for "${entry.actor}"`)
  }
  if (entry.verb === 'shows' && entry.cards) {
    return `${entry.actor} shows ${formatCard(entry.cards[0])}${formatCard(entry.cards[1])}`
  }
  return `${entry.actor} ${entry.verb}`
}

/**
 * Serialize a HandState back to its canonical normalized text form (used only
 * at the Firebase persistence boundary).
 * Round-trip invariant: parseHand(serializeHand(state)) ≡ state (structurally,
 * ignoring node ids). Throws if the state is incomplete.
 */
export function serializeHand(state: HandState): string {
  if (state.board === undefined) throw new Error('Cannot serialize: board not set')
  if (state.hero === undefined || state.hero.cards === undefined) {
    throw new Error('Cannot serialize: hero not complete')
  }

  const lines: string[] = []
  const emitNotes = (anchor: NoteAnchor) => {
    for (const note of state.notes) {
      if (note.anchor === anchor) lines.push(`# ${note.text}`)
    }
  }

  emitNotes('top')

  if (state.stakes !== undefined) {
    lines.push(`[Stakes: ${state.stakes}]`)
    emitNotes('stakes')
  }

  const boardCards = state.board.map(formatCard).join(' ')
  lines.push(`Board: ${boardCards}`)
  emitNotes('board')

  const heroCards = formatCard(state.hero.cards[0]) + formatCard(state.hero.cards[1])
  lines.push(`Hero: ${state.hero.position} ${heroCards}`)
  emitNotes('hero')

  for (const street of state.streets) {
    lines.push(serializeStreet(street))
    emitNotes(street.name)
  }

  if (state.showdown !== undefined) {
    lines.push(`Showdown: ${state.showdown.map(serializeShowdownEntry).join(', ')}`)
    emitNotes('showdown')
  }

  return lines.join('\n')
}
