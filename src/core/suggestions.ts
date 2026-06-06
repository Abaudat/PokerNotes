import { RANKS, SUITS } from './cards'
import type { SuggestionResult, SuggestionMode, SuggestionContext, StreetName } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_POSITIONS = ['H', 'V', 'V2', 'V3', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']

const HERO_POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']

const STREET_ORDER: StreetName[] = ['Preflop', 'Flop', 'Turn', 'River']

// Verbs that require an amount following them
const AMOUNT_VERBS = new Set(['r', 'b'])

// ---------------------------------------------------------------------------
// Helpers — card codes
// ---------------------------------------------------------------------------

function allCardCodes(): string[] {
  const codes: string[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      codes.push(rank + suit)
    }
  }
  return codes
}

/** Count 2-char card codes in a string (handles both packed and space-separated). */
function countCardCodes(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  let count = 0
  let i = 0
  while (i < trimmed.length) {
    if (/\s/.test(trimmed[i])) {
      i++
      continue
    }
    // consume 2 chars as one card code
    i += 2
    count++
  }
  return count
}

/** Collect the set of card codes that appear in a string. */
function collectCardCodes(text: string): Set<string> {
  const used = new Set<string>()
  const trimmed = text.trim()
  let i = 0
  while (i < trimmed.length) {
    if (/\s/.test(trimmed[i])) {
      i++
      continue
    }
    if (i + 1 < trimmed.length) {
      used.add(trimmed[i] + trimmed[i + 1])
    }
    i += 2
  }
  return used
}

// ---------------------------------------------------------------------------
// Helpers — partial line analysis
// ---------------------------------------------------------------------------

interface PartialHand {
  boardContent: string | null  // null = no Board: line found
  heroContent: string | null   // null = no Hero: line found
  streets: { name: StreetName; actionsStr: string }[]
}

function parsePartialHand(raw: string): PartialHand {
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l !== '')

  let boardContent: string | null = null
  let heroContent: string | null = null
  const streets: { name: StreetName; actionsStr: string }[] = []

  for (const line of lines) {
    if (line.startsWith('Board:')) {
      boardContent = line.slice('Board:'.length)
    } else if (line.startsWith('Hero:')) {
      heroContent = line.slice('Hero:'.length)
    } else {
      for (const streetName of STREET_ORDER) {
        if (line.startsWith(streetName + ':')) {
          streets.push({
            name: streetName,
            actionsStr: line.slice(streetName.length + 1).trim(),
          })
        }
      }
    }
  }

  return { boardContent, heroContent, streets }
}

// ---------------------------------------------------------------------------
// Helpers — facing-bet detection
// ---------------------------------------------------------------------------

/**
 * Given all COMPLETE action segments (already-finished, comma-separated pieces),
 * returns true if the last one has a verb that is a bet or raise.
 */
function isLastActionABet(completeSegments: string[]): boolean {
  if (completeSegments.length === 0) return false
  const last = completeSegments[completeSegments.length - 1].trim()
  const parts = last.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return false
  return AMOUNT_VERBS.has(parts[1])
}

// ---------------------------------------------------------------------------
// Helpers — street advancement
// ---------------------------------------------------------------------------

function canAdvanceToNextStreet(current: StreetName, boardCardCount: number): boolean {
  switch (current) {
    case 'Preflop':
      return boardCardCount >= 3
    case 'Flop':
      return boardCardCount >= 4
    case 'Turn':
      return boardCardCount >= 5
    case 'River':
      return false
  }
}

// ---------------------------------------------------------------------------
// Street-actions analysis
// ---------------------------------------------------------------------------

interface StreetAnalysis {
  mode: SuggestionMode
  options: string[]
  context: SuggestionContext
}

function analyzeStreetActions(
  actionsStr: string,
  streetName: StreetName,
  boardCardCount: number,
): StreetAnalysis {
  const segments = actionsStr.split(',').map((s) => s.trim())

  // Filter to segments that have content
  const nonEmpty = segments.filter((s) => s !== '')

  if (nonEmpty.length === 0) {
    return {
      mode: 'AWAIT_ACTOR',
      options: ALL_POSITIONS,
      context: { street: streetName },
    }
  }

  const lastSeg = nonEmpty[nonEmpty.length - 1]
  const prevComplete = nonEmpty.slice(0, -1)
  const parts = lastSeg.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return {
      mode: 'AWAIT_ACTOR',
      options: ALL_POSITIONS,
      context: { street: streetName },
    }
  }

  const actor = parts[0]

  // Only the actor — waiting for verb
  if (parts.length === 1) {
    const facingBet = isLastActionABet(prevComplete)
    const verbOptions = facingBet ? ['c', 'r', 'f'] : ['x', 'b', 'f']
    return {
      mode: 'AWAIT_VERB',
      options: verbOptions,
      context: { street: streetName, actor, facingBet },
    }
  }

  const verb = parts[1]

  // Actor + verb that requires an amount, but no amount yet
  if (AMOUNT_VERBS.has(verb) && parts.length === 2) {
    return {
      mode: 'AWAIT_AMOUNT',
      options: [],
      context: { street: streetName, actor },
    }
  }

  // Last action is complete — ask for next actor (or advance/save)
  const canAdvance = canAdvanceToNextStreet(streetName, boardCardCount)
  return {
    mode: 'AWAIT_ACTOR',
    options: ALL_POSITIONS,
    context: { street: streetName, canAdvance, canSave: true },
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Given the current raw hand text (which may be partial / incomplete),
 * returns what the recording UI should prompt for next.
 */
export function nextSuggestions(raw: string): SuggestionResult {
  const { boardContent, heroContent, streets } = parsePartialHand(raw)

  // ── AWAIT_BOARD ──────────────────────────────────────────────────────────
  if (boardContent === null) {
    return {
      mode: 'AWAIT_BOARD',
      options: ['NO_BOARD', ...allCardCodes()],
    }
  }

  const boardCardCount = countCardCodes(boardContent)

  // ── AWAIT_HERO_POS ───────────────────────────────────────────────────────
  if (heroContent === null) {
    return {
      mode: 'AWAIT_HERO_POS',
      options: HERO_POSITIONS,
    }
  }

  const heroTokens = heroContent.trim().split(/\s+/).filter(Boolean)
  if (heroTokens.length === 0) {
    return {
      mode: 'AWAIT_HERO_POS',
      options: HERO_POSITIONS,
    }
  }

  // ── AWAIT_HERO_CARDS ─────────────────────────────────────────────────────
  // heroTokens[0] = position; remaining tokens are card text (packed or spaced)
  const heroCardStr = heroTokens.slice(1).join('')
  const heroCardCount = countCardCodes(heroCardStr)

  if (heroCardCount < 2) {
    // Which cards are already in use (board + any partially-entered hero card)?
    const usedCards = collectCardCodes(boardContent)
    collectCardCodes(heroCardStr).forEach((c) => usedCards.add(c))
    const available = allCardCodes().filter((c) => !usedCards.has(c))
    return {
      mode: 'AWAIT_HERO_CARDS',
      options: available,
    }
  }

  // ── Streets ──────────────────────────────────────────────────────────────
  if (streets.length === 0) {
    return {
      mode: 'AWAIT_ACTOR',
      options: ALL_POSITIONS,
      context: { street: 'Preflop' },
    }
  }

  const lastStreet = streets[streets.length - 1]
  const { mode, options, context } = analyzeStreetActions(
    lastStreet.actionsStr,
    lastStreet.name,
    boardCardCount,
  )
  return { mode, options, context }
}
