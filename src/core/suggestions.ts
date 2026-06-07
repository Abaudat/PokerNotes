import { RANKS, SUITS } from './cards'
import type { SuggestionResult, SuggestionMode, SuggestionContext, StreetName } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_POSITIONS = [
  'H', 'V', 'V2', 'V3', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3',
  'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP',
]

const HERO_POSITIONS = [
  'UTG', 'UTG+1', 'UTG+2', 'UTG+3',
  'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP',
]

const STREET_ORDER: StreetName[] = ['Preflop', 'Flop', 'Turn', 'River']

/** Verbs requiring a mandatory amount */
const AMOUNT_VERBS = new Set(['r', 'b'])
/** Verbs with an optional amount (all-in). Internal code 'a'; raw text 'all in'. */
const OPTIONAL_AMOUNT_VERBS = new Set(['a'])
const SHOWDOWN_VERBS_LIST = ['shows', 'wins', 'loses']

// ---------------------------------------------------------------------------
// Helpers — card codes
// ---------------------------------------------------------------------------

export function allCardCodes(): string[] {
  const codes: string[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      codes.push(rank + suit)
    }
  }
  return codes
}

export function countCardCodes(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  let count = 0
  let i = 0
  while (i < trimmed.length) {
    if (/\s/.test(trimmed[i])) { i++; continue }
    i += 2
    count++
  }
  return count
}

export function collectCardCodes(text: string): Set<string> {
  const used = new Set<string>()
  const trimmed = text.trim()
  let i = 0
  while (i < trimmed.length) {
    if (/\s/.test(trimmed[i])) { i++; continue }
    if (i + 1 < trimmed.length) used.add(trimmed[i] + trimmed[i + 1])
    i += 2
  }
  return used
}

// ---------------------------------------------------------------------------
// Helpers — partial line analysis
// ---------------------------------------------------------------------------

interface PartialHand {
  boardContent: string | null
  heroContent: string | null
  streets: { name: StreetName; actionsStr: string }[]
  showdownContent: string | null
}

function parsePartialHand(raw: string): PartialHand {
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l !== '')

  let boardContent: string | null = null
  let heroContent: string | null = null
  let showdownContent: string | null = null
  const streets: { name: StreetName; actionsStr: string }[] = []

  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (line.startsWith('[')) continue
    if (line.startsWith('Board:')) {
      boardContent = line.slice('Board:'.length)
    } else if (line.startsWith('Hero:')) {
      heroContent = line.slice('Hero:'.length)
    } else if (line.startsWith('Showdown:')) {
      showdownContent = line.slice('Showdown:'.length)
    } else {
      for (const streetName of STREET_ORDER) {
        if (line.startsWith(streetName + ':')) {
          streets.push({ name: streetName, actionsStr: line.slice(streetName.length + 1).trim() })
        }
      }
    }
  }

  return { boardContent, heroContent, streets, showdownContent }
}

// ---------------------------------------------------------------------------
// Verb extraction (handles "all in" two-word verb → internal 'a')
// ---------------------------------------------------------------------------

interface VerbResult {
  verbInternal: string
  remaining: string[]
}

function extractVerb(parts: string[]): VerbResult {
  if (parts[0] === 'all' && parts[1] === 'in') {
    return { verbInternal: 'a', remaining: parts.slice(2) }
  }
  return { verbInternal: parts[0] ?? '', remaining: parts.slice(1) }
}

// ---------------------------------------------------------------------------
// Helpers — facing-bet detection
// ---------------------------------------------------------------------------

export function isLastActionABet(completeSegments: string[]): boolean {
  if (completeSegments.length === 0) return false
  const last = completeSegments[completeSegments.length - 1].trim()
  const parts = last.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return false
  const { verbInternal } = extractVerb(parts.slice(1))
  return AMOUNT_VERBS.has(verbInternal) || OPTIONAL_AMOUNT_VERBS.has(verbInternal)
}

// ---------------------------------------------------------------------------
// Helpers — street advancement
// ---------------------------------------------------------------------------

function canAdvanceToNextStreet(current: StreetName, boardCardCount: number): boolean {
  switch (current) {
    case 'Preflop': return boardCardCount >= 3
    case 'Flop':    return boardCardCount >= 4
    case 'Turn':    return boardCardCount >= 5
    case 'River':   return false
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
  const hasTrailingComma = segments.length > 0 && segments[segments.length - 1] === ''
  const nonEmpty = segments.filter((s) => s !== '')

  if (nonEmpty.length === 0) {
    return { mode: 'AWAIT_ACTOR', options: ALL_POSITIONS, context: { street: streetName } }
  }

  const lastSeg = nonEmpty[nonEmpty.length - 1]
  const prevComplete = nonEmpty.slice(0, -1)
  const parts = lastSeg.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { mode: 'AWAIT_ACTOR', options: ALL_POSITIONS, context: { street: streetName } }
  }

  const actor = parts[0]

  if (parts.length === 1) {
    const facingBet = isLastActionABet(prevComplete)
    const verbOptions = facingBet ? ['c', 'r', 'f', 'all in'] : ['x', 'b', 'f', 'all in']
    return { mode: 'AWAIT_VERB', options: verbOptions, context: { street: streetName, actor, facingBet } }
  }

  const { verbInternal, remaining } = extractVerb(parts.slice(1))

  if (AMOUNT_VERBS.has(verbInternal) && remaining.length === 0) {
    return { mode: 'AWAIT_AMOUNT', options: [], context: { street: streetName, actor } }
  }

  // All-in: optional amount — only show AWAIT_AMOUNT_OPT when no trailing comma (not yet skipped)
  if (OPTIONAL_AMOUNT_VERBS.has(verbInternal) && remaining.length === 0 && !hasTrailingComma) {
    return { mode: 'AWAIT_AMOUNT_OPT', options: [], context: { street: streetName, actor } }
  }

  const canAdvance = canAdvanceToNextStreet(streetName, boardCardCount)
  return {
    mode: 'AWAIT_ACTOR',
    options: ALL_POSITIONS,
    context: { street: streetName, canAdvance, canSave: true, canShowdown: true },
  }
}

// ---------------------------------------------------------------------------
// Showdown analysis
// ---------------------------------------------------------------------------

function analyzeShowdown(actionsStr: string, usedCards: Set<string>): StreetAnalysis {
  const segments = actionsStr.split(',').map((s) => s.trim())
  const nonEmpty = segments.filter((s) => s !== '')

  if (nonEmpty.length === 0) {
    return { mode: 'AWAIT_SHOWDOWN_ACTOR', options: ALL_POSITIONS, context: {} }
  }

  const lastSeg = nonEmpty[nonEmpty.length - 1]
  const parts = lastSeg.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { mode: 'AWAIT_SHOWDOWN_ACTOR', options: ALL_POSITIONS, context: {} }
  }

  const actor = parts[0]

  if (parts.length === 1) {
    return { mode: 'AWAIT_SHOWDOWN_VERB', options: SHOWDOWN_VERBS_LIST, context: { actor } }
  }

  const verb = parts[1]

  if (verb === 'shows') {
    const cardsText = parts.slice(2).join('')
    const cardCount = countCardCodes(cardsText)
    if (cardCount < 2) {
      const available = allCardCodes().filter((c) => !usedCards.has(c))
      return { mode: 'AWAIT_SHOWDOWN_CARDS', options: available, context: { actor } }
    }
  }

  return { mode: 'AWAIT_SHOWDOWN_ACTOR', options: ALL_POSITIONS, context: { canSave: true } }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function nextSuggestions(raw: string): SuggestionResult {
  const { boardContent, heroContent, streets, showdownContent } = parsePartialHand(raw)

  if (boardContent === null) {
    return { mode: 'AWAIT_BOARD', options: ['NO_BOARD', ...allCardCodes()] }
  }

  const boardCardCount = countCardCodes(boardContent)

  if (heroContent === null) {
    return { mode: 'AWAIT_HERO_POS', options: HERO_POSITIONS }
  }

  const heroTokens = heroContent.trim().split(/\s+/).filter(Boolean)
  if (heroTokens.length === 0) {
    return { mode: 'AWAIT_HERO_POS', options: HERO_POSITIONS }
  }

  const heroCardStr = heroTokens.slice(1).join('')
  const heroCardCount = countCardCodes(heroCardStr)

  if (heroCardCount < 2) {
    const usedCards = collectCardCodes(boardContent)
    collectCardCodes(heroCardStr).forEach((c) => usedCards.add(c))
    const available = allCardCodes().filter((c) => !usedCards.has(c))
    return { mode: 'AWAIT_HERO_CARDS', options: available }
  }

  if (showdownContent !== null) {
    const allUsed = collectCardCodes(boardContent)
    collectCardCodes(heroCardStr).forEach((c) => allUsed.add(c))
    collectCardCodes(showdownContent).forEach((c) => allUsed.add(c))
    const { mode, options, context } = analyzeShowdown(showdownContent, allUsed)
    return { mode, options, context }
  }

  if (streets.length === 0) {
    return { mode: 'AWAIT_ACTOR', options: ALL_POSITIONS, context: { street: 'Preflop' } }
  }

  const lastStreet = streets[streets.length - 1]
  const { mode, options, context } = analyzeStreetActions(
    lastStreet.actionsStr,
    lastStreet.name,
    boardCardCount,
  )
  return { mode, options, context }
}
