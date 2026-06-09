import { parseHand } from '../core/parser'
import { formatCard } from '../core/cards'
import { computePotAtStreetStart } from '../core/engine'
import type { HandSummary } from './repository'

const STREET_REACHED_ORDER = ['Preflop', 'Flop', 'Turn', 'River'] as const

export function summaryFromRaw(raw: string): HandSummary {
  const state = parseHand(raw)
  const board = (state.board ?? []).map(formatCard)
  const heroCards = state.hero?.cards ? state.hero.cards.map(formatCard).join('') : ''
  const heroPosition = state.hero?.position ?? 'H'
  const lastStreet = state.streets[state.streets.length - 1].name
  const streetReached = STREET_REACHED_ORDER.includes(lastStreet as (typeof STREET_REACHED_ORDER)[number])
    ? lastStreet
    : 'Preflop'
  const stakes = state.stakes
  const totalPot = computePotAtStreetStart(state, state.streets.length)
  return {
    board,
    heroCards,
    heroPosition,
    streetReached,
    ...(stakes !== undefined ? { stakes } : {}),
    ...(totalPot > 0 ? { totalPot } : {}),
  }
}
