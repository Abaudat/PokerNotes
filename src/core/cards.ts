import type { Card, Rank, Suit } from './types'

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c']

export const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
]

export const SUIT_GLYPHS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
}

const RANK_SET = new Set<string>(RANKS)
const SUIT_SET = new Set<string>(SUITS)

/**
 * Parses a 2-character string like "As", "Th", "2c".
 * Rank is case-sensitive (must be uppercase or digit as defined).
 * Returns null if the input is not a valid card code.
 */
export function parseCard(s: string): Card | null {
  if (typeof s !== 'string' || s.length !== 2) return null
  const rank = s[0]
  const suit = s[1]
  if (!RANK_SET.has(rank) || !SUIT_SET.has(suit)) return null
  return { rank: rank as Rank, suit: suit as Suit }
}

/**
 * Formats a Card back to its 2-character code, e.g. { rank: 'A', suit: 's' } → "As".
 */
export function formatCard(c: Card): string {
  return c.rank + c.suit
}
