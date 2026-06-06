import { formatCard } from './cards'
import type { HandAST, Street, Action, ShowdownLine, ShowdownAction } from './types'

function serializeAction(action: Action): string {
  const actor = action.actor.value
  const verb = action.verb.value
  if (action.amount !== undefined) {
    return `${actor} ${verb} ${action.amount.value}`
  }
  return `${actor} ${verb}`
}

function serializeStreet(street: Street): string {
  const actions = street.actions.map(serializeAction).join(', ')
  return `${street.name}: ${actions}`
}

function serializeShowdownAction(action: ShowdownAction): string {
  const actor = action.actor.value
  const verb = action.verb.value
  if (verb === 'shows' && action.cards) {
    const c1 = formatCard(action.cards[0].value)
    const c2 = formatCard(action.cards[1].value)
    return `${actor} ${verb} ${c1}${c2}`
  }
  return `${actor} ${verb}`
}

function serializeShowdown(showdown: ShowdownLine): string {
  const actions = showdown.actions.map(serializeShowdownAction).join(', ')
  return `Showdown: ${actions}`
}

/**
 * Serialize a HandAST back to its canonical normalized text form.
 * Round-trip invariant: parseHand(serializeHand(ast)) ≡ ast.
 */
export function serializeHand(ast: HandAST): string {
  const lines: string[] = []

  if (ast.stakes !== undefined) {
    lines.push(`[Stakes: ${ast.stakes.raw.value}]`)
  }

  const boardCards = ast.board.cards.map((t) => formatCard(t.value)).join(' ')
  lines.push(`Board: ${boardCards}`)

  const heroPos = ast.hero.position.value
  const heroCards = formatCard(ast.hero.cards[0].value) + formatCard(ast.hero.cards[1].value)
  lines.push(`Hero: ${heroPos} ${heroCards}`)

  for (const street of ast.streets) {
    lines.push(serializeStreet(street))
  }

  if (ast.showdown !== undefined) {
    lines.push(serializeShowdown(ast.showdown))
  }

  return lines.join('\n')
}
