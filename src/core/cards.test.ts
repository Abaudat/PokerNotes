import { describe, it, expect } from 'vitest'
import {
  parseCard,
  formatCard,
  SUITS,
  RANKS,
  SUIT_GLYPHS,
} from './cards'
import type { Card } from './types'

// ---------------------------------------------------------------------------
// parseCard — happy path
// ---------------------------------------------------------------------------

describe('parseCard — happy path', () => {
  it('parses all 52 valid cards without error', () => {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const result = parseCard(rank + suit)
        expect(result).not.toBeNull()
        expect(result?.rank).toBe(rank)
        expect(result?.suit).toBe(suit)
      }
    }
  })

  it('parses Ace of spades', () => {
    expect(parseCard('As')).toEqual({ rank: 'A', suit: 's' })
  })

  it('parses Ten of hearts', () => {
    expect(parseCard('Th')).toEqual({ rank: 'T', suit: 'h' })
  })

  it('parses 2 of clubs', () => {
    expect(parseCard('2c')).toEqual({ rank: '2', suit: 'c' })
  })

  it('parses King of diamonds', () => {
    expect(parseCard('Kd')).toEqual({ rank: 'K', suit: 'd' })
  })

  it('parses Jack of hearts', () => {
    expect(parseCard('Jh')).toEqual({ rank: 'J', suit: 'h' })
  })

  it('parses Queen of spades', () => {
    expect(parseCard('Qs')).toEqual({ rank: 'Q', suit: 's' })
  })

  it('parses 9 of hearts', () => {
    expect(parseCard('9h')).toEqual({ rank: '9', suit: 'h' })
  })
})

// ---------------------------------------------------------------------------
// parseCard — case sensitivity
// ---------------------------------------------------------------------------

describe('parseCard — case sensitivity', () => {
  it('rejects lowercase rank "a" (should be "A")', () => {
    expect(parseCard('as')).toBeNull()
  })

  it('rejects lowercase rank "t" (should be "T")', () => {
    expect(parseCard('th')).toBeNull()
  })

  it('rejects lowercase rank "j" (should be "J")', () => {
    expect(parseCard('jd')).toBeNull()
  })

  it('rejects lowercase rank "q" (should be "Q")', () => {
    expect(parseCard('qc')).toBeNull()
  })

  it('rejects lowercase rank "k" (should be "K")', () => {
    expect(parseCard('ks')).toBeNull()
  })

  it('accepts uppercase suit in rank position correctly ("AH" is invalid — suit must be lowercase)', () => {
    // Suit must be lowercase: 'H' is not a valid suit
    expect(parseCard('AH')).toBeNull()
  })

  it('accepts valid suit characters as-is (lowercase only)', () => {
    expect(parseCard('As')).not.toBeNull()
    expect(parseCard('Ah')).not.toBeNull()
    expect(parseCard('Ad')).not.toBeNull()
    expect(parseCard('Ac')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseCard — invalid inputs
// ---------------------------------------------------------------------------

describe('parseCard — invalid inputs', () => {
  it('returns null for empty string', () => {
    expect(parseCard('')).toBeNull()
  })

  it('returns null for single character', () => {
    expect(parseCard('A')).toBeNull()
  })

  it('returns null for three characters', () => {
    expect(parseCard('Ash')).toBeNull()
  })

  it('returns null for four or more characters', () => {
    expect(parseCard('AsAh')).toBeNull()
  })

  it('returns null for invalid rank character', () => {
    expect(parseCard('Xs')).toBeNull()
    expect(parseCard('1s')).toBeNull()
    expect(parseCard('0s')).toBeNull()
    expect(parseCard('Bs')).toBeNull()
  })

  it('returns null for invalid suit character', () => {
    expect(parseCard('Ax')).toBeNull()
    expect(parseCard('Ay')).toBeNull()
    expect(parseCard('Az')).toBeNull()
    expect(parseCard('A1')).toBeNull()
  })

  it('returns null for whitespace strings', () => {
    expect(parseCard('  ')).toBeNull()
    expect(parseCard(' s')).toBeNull()
  })

  it('returns null for numeric-only string of length 2', () => {
    expect(parseCard('23')).toBeNull() // '3' is not a valid suit
  })
})

// ---------------------------------------------------------------------------
// formatCard
// ---------------------------------------------------------------------------

describe('formatCard', () => {
  it('formats Ace of spades', () => {
    expect(formatCard({ rank: 'A', suit: 's' })).toBe('As')
  })

  it('formats Ten of hearts', () => {
    expect(formatCard({ rank: 'T', suit: 'h' })).toBe('Th')
  })

  it('formats 2 of clubs', () => {
    expect(formatCard({ rank: '2', suit: 'c' })).toBe('2c')
  })

  it('formats King of diamonds', () => {
    expect(formatCard({ rank: 'K', suit: 'd' })).toBe('Kd')
  })
})

// ---------------------------------------------------------------------------
// formatCard round-trip
// ---------------------------------------------------------------------------

describe('formatCard round-trip', () => {
  it('parseCard(formatCard(c)) equals c for all 52 cards', () => {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const card: Card = { rank, suit }
        expect(parseCard(formatCard(card))).toEqual(card)
      }
    }
  })

  it('formatCard(parseCard(s)!) equals s for all 52 valid card codes', () => {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const s = rank + suit
        const card = parseCard(s)
        expect(card).not.toBeNull()
        expect(formatCard(card!)).toBe(s)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// SUIT_GLYPHS
// ---------------------------------------------------------------------------

describe('SUIT_GLYPHS', () => {
  it('has the correct Unicode symbol for spades', () => {
    expect(SUIT_GLYPHS['s']).toBe('♠')
  })

  it('has the correct Unicode symbol for hearts', () => {
    expect(SUIT_GLYPHS['h']).toBe('♥')
  })

  it('has the correct Unicode symbol for diamonds', () => {
    expect(SUIT_GLYPHS['d']).toBe('♦')
  })

  it('has the correct Unicode symbol for clubs', () => {
    expect(SUIT_GLYPHS['c']).toBe('♣')
  })

  it('has an entry for every suit', () => {
    for (const suit of SUITS) {
      expect(SUIT_GLYPHS[suit]).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// RANKS and SUITS constants
// ---------------------------------------------------------------------------

describe('RANKS constant', () => {
  it('contains exactly 13 ranks', () => {
    expect(RANKS).toHaveLength(13)
  })

  it('starts with 2 and ends with A', () => {
    expect(RANKS[0]).toBe('2')
    expect(RANKS[RANKS.length - 1]).toBe('A')
  })

  it('contains T (Ten) not 10', () => {
    expect(RANKS).toContain('T')
    expect(RANKS).not.toContain('10')
  })
})

describe('SUITS constant', () => {
  it('contains exactly 4 suits', () => {
    expect(SUITS).toHaveLength(4)
  })

  it('contains s, h, d, c', () => {
    expect(SUITS).toContain('s')
    expect(SUITS).toContain('h')
    expect(SUITS).toContain('d')
    expect(SUITS).toContain('c')
  })
})
