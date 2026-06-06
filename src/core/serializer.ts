import { formatCard } from './cards'
import type { HandAST, Street, Action } from './types'

// ---------------------------------------------------------------------------
// Action serialization
// ---------------------------------------------------------------------------

function serializeAction(action: Action): string {
  const actor = action.actor.value
  const verb = action.verb.value
  if (action.amount !== undefined) {
    return `${actor} ${verb} ${action.amount.value}`
  }
  return `${actor} ${verb}`
}

// ---------------------------------------------------------------------------
// Street serialization
// ---------------------------------------------------------------------------

function serializeStreet(street: Street): string {
  const actions = street.actions.map(serializeAction).join(', ')
  return `${street.name}: ${actions}`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Serialize a HandAST back to its canonical normalized text form.
 *
 * Format:
 *   [Stakes: {value}]          ← only when stakes is present
 *   Board: {card} {card} …     ← always; empty board = "Board: "
 *   Hero: {position} {card1}{card2}
 *   {StreetName}: {actor} {verb} [{amount}], …
 *
 * Lines are separated by '\n'.
 */
export function serializeHand(ast: HandAST): string {
  const lines: string[] = []

  // Stakes (optional)
  if (ast.stakes !== undefined) {
    lines.push(`[Stakes: ${ast.stakes.raw.value}]`)
  }

  // Board
  const boardCards = ast.board.cards.map((t) => formatCard(t.value)).join(' ')
  lines.push(`Board: ${boardCards}`)

  // Hero: position then both cards packed (no space between them)
  const heroPos = ast.hero.position.value
  const heroCards =
    formatCard(ast.hero.cards[0].value) + formatCard(ast.hero.cards[1].value)
  lines.push(`Hero: ${heroPos} ${heroCards}`)

  // Streets
  for (const street of ast.streets) {
    lines.push(serializeStreet(street))
  }

  return lines.join('\n')
}
