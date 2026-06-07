import { RANKS, SUITS } from './cards'
import type { SuggestionResult, SuggestionMode, SuggestionContext, StreetName } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POSITION_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const GENERIC_POSITIONS = ['H', 'V', 'V2', 'V3']

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
/** Verbs that re-open the action — everyone else gets another turn */
const REOPENING_VERBS = new Set(['r', 'b', 'a'])
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
// Helpers — position ordering and filtering
// ---------------------------------------------------------------------------

function sortPositions(positions: string[]): string[] {
  const posSet = new Set(positions)
  const generics = GENERIC_POSITIONS.filter((p) => posSet.has(p))
  const ordered = POSITION_ORDER.filter((p) => posSet.has(p))
  const others = positions.filter((p) => !GENERIC_POSITIONS.includes(p) && !POSITION_ORDER.includes(p))
  return [...generics, ...ordered, ...others]
}

function getActorsFromSegments(segments: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const seg of segments) {
    const parts = seg.split(/\s+/).filter(Boolean)
    if (parts.length > 0 && !seen.has(parts[0])) {
      seen.add(parts[0])
      result.push(parts[0])
    }
  }
  return result
}

function getLastActorFromSegments(segments: string[]): string | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const parts = segments[i].split(/\s+/).filter(Boolean)
    if (parts.length > 0) return parts[0]
  }
  return null
}

function buildActorOptions(streetName: StreetName, completedSegments: string[], preflopActors: string[]): string[] {
  // Find the last re-opening action (bet/raise/all-in) by scanning backwards.
  // Everything after it is the "current response round"; earlier segments precede the re-open.
  let lastReopenIdx = -1
  for (let i = completedSegments.length - 1; i >= 0; i--) {
    const parts = completedSegments[i].split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const { verbInternal } = extractVerb(parts.slice(1))
      if (REOPENING_VERBS.has(verbInternal)) { lastReopenIdx = i; break }
    }
  }

  if (lastReopenIdx !== -1) {
    const reopener = completedSegments[lastReopenIdx].split(/\s+/).filter(Boolean)[0]
    const beforeReopen = getActorsFromSegments(completedSegments.slice(0, lastReopenIdx))
    const afterReopen = new Set(getActorsFromSegments(completedSegments.slice(lastReopenIdx + 1)))
    return buildReopenOptions(streetName, reopener, beforeReopen, afterReopen, preflopActors)
  }

  // No bet/raise on this street yet — linear progression.
  const spokenSet = new Set(getActorsFromSegments(completedSegments))
  const lastActor = getLastActorFromSegments(completedSegments)

  if (streetName === 'Preflop') {
    const generics = GENERIC_POSITIONS.filter((p) => !spokenSet.has(p))
    let maxSpokenIdx = -1
    for (const seg of completedSegments) {
      const parts = seg.split(/\s+/).filter(Boolean)
      if (parts.length > 0) {
        const idx = POSITION_ORDER.indexOf(parts[0])
        if (idx > maxSpokenIdx) maxSpokenIdx = idx
      }
    }
    const ordered = maxSpokenIdx === -1
      ? POSITION_ORDER.filter((p) => !spokenSet.has(p))
      : POSITION_ORDER.slice(maxSpokenIdx + 1)
    return [...generics, ...ordered]
  }

  // Postflop linear
  if (!lastActor) return sortPositions(preflopActors)
  const lastIdx = POSITION_ORDER.indexOf(lastActor)
  return sortPositions(preflopActors.filter((p) => {
    if (spokenSet.has(p)) return false
    const pIdx = POSITION_ORDER.indexOf(p)
    if (lastIdx === -1 || pIdx === -1) return true
    return pIdx > lastIdx
  }))
}

/**
 * After a re-open (bet/raise/all-in), build the response-order list and apply a
 * "skip = folded" frontier: if actor X (at response-order index I) has replied,
 * all positions at indices < I who have NOT replied are considered to have folded.
 * Suggest only positions at indices > the frontier that haven't replied.
 */
function buildReopenOptions(
  streetName: StreetName,
  reopener: string,
  spokenBefore: string[],   // unique actors who spoke before the re-open
  spokenAfter: Set<string>, // actors who have spoken in response to the re-open
  preflopActors: string[],
): string[] {
  const reopenerIdx = POSITION_ORDER.indexOf(reopener)
  const beforeSet = new Set(spokenBefore)

  let responseOrder: string[]

  if (streetName === 'Preflop') {
    // First timers: ordered positions after the re-opener (haven't been in the hand yet)
    const orderedFirst = reopenerIdx === -1
      ? POSITION_ORDER.filter((p) => !beforeSet.has(p))
      : POSITION_ORDER.slice(reopenerIdx + 1)
    // Second timers: everyone who spoke before the re-open (excluding the re-opener)
    const orderedSecond = POSITION_ORDER.filter((p) => beforeSet.has(p) && p !== reopener)
    const genFirst = GENERIC_POSITIONS.filter((p) => !beforeSet.has(p) && p !== reopener)
    const genSecond = GENERIC_POSITIONS.filter((p) => beforeSet.has(p) && p !== reopener)
    responseOrder = [...genFirst, ...orderedFirst, ...genSecond, ...orderedSecond]
  } else {
    // Postflop: restrict to preflop actors
    const orderedFirst = preflopActors.filter((p) => {
      if (p === reopener) return false
      const pIdx = POSITION_ORDER.indexOf(p)
      if (reopenerIdx === -1 || pIdx === -1) return !beforeSet.has(p)
      return pIdx > reopenerIdx
    })
    const orderedSecond = preflopActors.filter((p) => p !== reopener && beforeSet.has(p))
    responseOrder = [...sortPositions(orderedFirst), ...sortPositions(orderedSecond)]
  }

  // Find the latest position in responseOrder that has replied after the re-open.
  // All positions before it that have NOT replied are considered skipped (folded).
  let frontierIdx = -1
  for (let i = responseOrder.length - 1; i >= 0; i--) {
    if (spokenAfter.has(responseOrder[i])) { frontierIdx = i; break }
  }

  return frontierIdx === -1 ? responseOrder : responseOrder.slice(frontierIdx + 1)
}

/**
 * Given a completed street actionsStr and the pool of actors who were active
 * entering that street, return the subset still active after it — removing
 * explicit folders (verb 'f') and implicit folders (actors in the re-open
 * response order who were bypassed or never responded before the street ended).
 */
function computeActiveActors(actionsStr: string, pool: string[]): string[] {
  const segments = actionsStr.split(',').map((s) => s.trim()).filter((s) => s !== '')

  const explicitFolders = new Set<string>()
  for (const seg of segments) {
    const parts = seg.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const { verbInternal } = extractVerb(parts.slice(1))
      if (verbInternal === 'f') explicitFolders.add(parts[0])
    }
  }

  let lastReopenIdx = -1
  for (let i = segments.length - 1; i >= 0; i--) {
    const parts = segments[i].split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const { verbInternal } = extractVerb(parts.slice(1))
      if (REOPENING_VERBS.has(verbInternal)) { lastReopenIdx = i; break }
    }
  }

  if (lastReopenIdx === -1) {
    return pool.filter((a) => !explicitFolders.has(a))
  }

  const reopener = segments[lastReopenIdx].split(/\s+/).filter(Boolean)[0]
  const reopenerIdx = POSITION_ORDER.indexOf(reopener)
  const beforeSet = new Set(getActorsFromSegments(segments.slice(0, lastReopenIdx)))
  const spokenAfterSet = new Set(getActorsFromSegments(segments.slice(lastReopenIdx + 1)))

  const firstTimers = pool.filter((p) => {
    if (p === reopener) return false
    const pIdx = POSITION_ORDER.indexOf(p)
    if (reopenerIdx === -1 || pIdx === -1) return !beforeSet.has(p)
    return pIdx > reopenerIdx
  })
  const secondTimers = pool.filter((p) => p !== reopener && beforeSet.has(p))
  const responseOrder = [...sortPositions(firstTimers), ...sortPositions(secondTimers)]

  const implicitFolders = new Set(responseOrder.filter((p) => !spokenAfterSet.has(p)))

  return pool.filter((a) => !explicitFolders.has(a) && !implicitFolders.has(a))
}

/**
 * From a completed preflop actionsStr, return the actors still active going
 * into postflop. The pool is derived from who appeared in preflop itself.
 */
function computePostflopActors(actionsStr: string): string[] {
  const segments = actionsStr.split(',').map((s) => s.trim()).filter((s) => s !== '')
  const seen = new Set<string>()
  const pool: string[] = []
  for (const seg of segments) {
    const parts = seg.split(/\s+/).filter(Boolean)
    if (parts.length >= 2 && !seen.has(parts[0])) { seen.add(parts[0]); pool.push(parts[0]) }
  }
  return computeActiveActors(actionsStr, pool)
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
  return completeSegments.some((seg) => {
    const parts = seg.trim().split(/\s+/).filter(Boolean)
    if (parts.length < 2) return false
    const { verbInternal } = extractVerb(parts.slice(1))
    return AMOUNT_VERBS.has(verbInternal) || OPTIONAL_AMOUNT_VERBS.has(verbInternal)
  })
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
  preflopActors: string[],
  heroPosition?: string | null,
): StreetAnalysis {
  const segments = actionsStr.split(',').map((s) => s.trim())
  const hasTrailingComma = segments.length > 0 && segments[segments.length - 1] === ''
  const nonEmpty = segments.filter((s) => s !== '')

  if (nonEmpty.length === 0) {
    return { mode: 'AWAIT_ACTOR', options: buildActorOptions(streetName, [], preflopActors), context: { street: streetName } }
  }

  const lastSeg = nonEmpty[nonEmpty.length - 1]
  const prevComplete = nonEmpty.slice(0, -1)
  const parts = lastSeg.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { mode: 'AWAIT_ACTOR', options: buildActorOptions(streetName, prevComplete, preflopActors), context: { street: streetName } }
  }

  const actor = parts[0]

  if (parts.length === 1) {
    let facingBet: boolean
    let verbOptions: string[]
    if (streetName === 'Preflop') {
      const resolvedActor = (actor === 'H' && heroPosition) ? heroPosition : actor
      const hasRaise = isLastActionABet(prevComplete)
      if (resolvedActor === 'BB' && !hasRaise) {
        facingBet = false
        verbOptions = ['x', 'r', 'f', 'all in']
      } else {
        facingBet = true
        verbOptions = ['c', 'r', 'f', 'all in']
      }
    } else {
      facingBet = isLastActionABet(prevComplete)
      verbOptions = facingBet ? ['c', 'r', 'f', 'all in'] : ['x', 'b', 'f', 'all in']
    }
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
    options: buildActorOptions(streetName, nonEmpty, preflopActors),
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
  const heroPosition = heroTokens[0] ?? null
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
    return { mode: 'AWAIT_ACTOR', options: buildActorOptions('Preflop', [], []), context: { street: 'Preflop' } }
  }

  const preflopStreet = streets.find((s) => s.name === 'Preflop')
  let activePool = preflopStreet ? computePostflopActors(preflopStreet.actionsStr) : []

  // Reduce the pool through each completed postflop street (all streets except the last)
  const completedStreets = streets.slice(0, -1)
  for (const street of completedStreets) {
    if (street.name !== 'Preflop') {
      activePool = computeActiveActors(street.actionsStr, activePool)
    }
  }

  const lastStreet = streets[streets.length - 1]
  const { mode, options, context } = analyzeStreetActions(
    lastStreet.actionsStr,
    lastStreet.name,
    boardCardCount,
    activePool,
    heroPosition,
  )
  return { mode, options, context }
}
