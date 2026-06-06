import { parseHand } from '../core/parser'
import type { HandSummary } from './repository'

const STREET_REACHED_ORDER = ['Preflop', 'Flop', 'Turn', 'River'] as const

export function summaryFromRaw(raw: string): HandSummary {
  const ast = parseHand(raw)
  const board = ast.board.cards.map(t => t.value.rank + t.value.suit)
  const heroCards = ast.hero.cards.map(t => t.value.rank + t.value.suit).join('')
  const heroPosition = ast.hero.position.value
  const lastStreet = ast.streets[ast.streets.length - 1].name
  const streetReached = STREET_REACHED_ORDER.includes(lastStreet as typeof STREET_REACHED_ORDER[number])
    ? lastStreet
    : 'Preflop'
  const stakes = ast.stakes?.raw.value
  return { board, heroCards, heroPosition, streetReached, ...(stakes !== undefined ? { stakes } : {}) }
}
