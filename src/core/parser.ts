import { parseCard } from './cards'
import type {
  HandAST,
  StakesLine,
  BoardLine,
  HeroLine,
  Street,
  Action,
  Token,
  Card,
  Position,
  Verb,
  StreetName,
} from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_POSITIONS = new Set<string>([
  'H',
  'V',
  'V2',
  'V3',
  'UTG',
  'UTG+1',
  'UTG+2',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
  'EP',
  'MP',
])

const VALID_VERBS = new Set<string>(['x', 'c', 'r', 'f', 'b'])
const AMOUNT_VERBS = new Set<string>(['r', 'b'])
const STREET_NAMES = new Set<string>(['Preflop', 'Flop', 'Turn', 'River'])

// ---------------------------------------------------------------------------
// Counter-based ID generation (deterministic within one parse call)
// ---------------------------------------------------------------------------

let _idCounter = 0

function nextId(): string {
  return `tok_${++_idCounter}`
}

function resetIdCounter(): void {
  _idCounter = 0
}

// ---------------------------------------------------------------------------
// Parser state
// ---------------------------------------------------------------------------

interface ParserState {
  raw: string
  lines: { text: string; start: number }[]
  lineIndex: number
}

function buildState(raw: string): ParserState {
  const lines: { text: string; start: number }[] = []
  let pos = 0
  for (const text of raw.split('\n')) {
    lines.push({ text, start: pos })
    pos += text.length + 1 // +1 for the '\n'
  }
  return { raw, lines, lineIndex: 0 }
}

function currentLine(
  state: ParserState,
): { text: string; start: number } | null {
  if (state.lineIndex >= state.lines.length) return null
  return state.lines[state.lineIndex]
}

function advanceLine(state: ParserState): void {
  state.lineIndex++
  // Skip blank lines
  while (
    state.lineIndex < state.lines.length &&
    state.lines[state.lineIndex].text.trim() === ''
  ) {
    state.lineIndex++
  }
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function makeToken<T>(value: T, start: number, end: number): Token<T> {
  return { id: nextId(), value, span: { start, end } }
}

// ---------------------------------------------------------------------------
// Card parsing with span tracking
// ---------------------------------------------------------------------------

/**
 * Parse zero or more card codes from `text` starting at `textOffset`
 * (absolute offset of `text[0]` within raw).
 *
 * Cards may be:
 *   - space-separated:  "As 8h Td"
 *   - packed (no spaces): "AhKs"
 *   - mixed:            "As AhKs" (each whitespace-delimited token is
 *     itself split into 2-char chunks)
 *
 * Throws if any 2-char chunk is not a valid card code.
 */
function parseCards(
  text: string,
  textOffset: number,
): Token<Card>[] {
  const tokens: Token<Card>[] = []
  const trimmed = text.trim()
  if (trimmed === '') return tokens

  // Walk through the text character by character, skipping whitespace
  // and consuming 2-char card codes.
  let i = 0
  while (i < text.length) {
    // skip whitespace
    if (/\s/.test(text[i])) {
      i++
      continue
    }
    // consume 2 chars
    if (i + 1 >= text.length) {
      throw new Error(
        `Incomplete card code at offset ${textOffset + i}: "${text.slice(i)}"`,
      )
    }
    const word = text[i] + text[i + 1]
    const absStart = textOffset + i
    const absEnd = absStart + 2
    const card = parseCard(word)
    if (card === null) {
      throw new Error(
        `Invalid card code "${word}" at offset ${absStart}`,
      )
    }
    tokens.push(makeToken(card, absStart, absEnd))
    i += 2
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Line parsers
// ---------------------------------------------------------------------------

/**
 * "[Stakes: $2/$5]"  →  StakesLine
 * The raw token value is the text between "[Stakes:" and "]".
 */
function parseStakesLine(
  line: string,
  lineStart: number,
): StakesLine {
  const match = /^\[Stakes:(.*)\]$/.exec(line.trim())
  if (!match) {
    throw new Error(`Malformed Stakes line: "${line}"`)
  }
  // Locate the trimmed value inside the original line string
  const innerText = match[1] // e.g. " $2/$5"
  const trimmedValue = innerText.trim() // e.g. "$2/$5"
  // Find the trimmed value's position within the line for accurate span
  const innerLocalIdx = line.indexOf(match[1])
  const leadingSpaces = innerText.length - innerText.trimStart().length
  const absStart = lineStart + innerLocalIdx + leadingSpaces
  const absEnd = absStart + trimmedValue.length
  return { raw: makeToken(trimmedValue, absStart, absEnd) }
}

/**
 * "Board: As 8h Td"  →  BoardLine
 */
function parseBoardLine(line: string, lineStart: number): BoardLine {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed Board line: "${line}"`)
  const afterColon = line.slice(colonIdx + 1)
  const afterColonOffset = lineStart + colonIdx + 1
  const cards = parseCards(afterColon, afterColonOffset)
  if (cards.length !== 0 && cards.length !== 3 && cards.length !== 4 && cards.length !== 5) {
    throw new Error(
      `Board must have 0, 3, 4, or 5 cards; got ${cards.length}`,
    )
  }
  return { cards }
}

/**
 * "Hero: BTN AhKs"  →  HeroLine
 */
function parseHeroLine(line: string, lineStart: number): HeroLine {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed Hero line: "${line}"`)
  const afterColon = line.slice(colonIdx + 1).trim()
  const afterColonTrimOffset =
    lineStart + colonIdx + 1 + (line.slice(colonIdx + 1).length - line.slice(colonIdx + 1).trimStart().length)

  // Split into whitespace-delimited tokens: first is position, remainder are card text
  const tokens = afterColon.split(/\s+/)
  if (tokens.length < 2) {
    throw new Error(
      `Hero line must have position and 2 cards; got: "${afterColon}"`,
    )
  }

  // Find the position token
  const posStr = tokens[0]
  const posLocalIdx = afterColon.indexOf(posStr)
  const posAbsStart = afterColonTrimOffset + posLocalIdx
  if (!VALID_POSITIONS.has(posStr)) {
    throw new Error(`Unknown position "${posStr}" in Hero line`)
  }
  const posToken = makeToken(posStr as Position, posAbsStart, posAbsStart + posStr.length)

  // The two cards follow the position (may be packed "AhKs" or spaced "Ah Ks")
  const cardsText = afterColon.slice(posLocalIdx + posStr.length)
  const cardsOffset = afterColonTrimOffset + posLocalIdx + posStr.length
  const cardTokens = parseCards(cardsText, cardsOffset)
  if (cardTokens.length !== 2) {
    throw new Error(
      `Hero line must have exactly 2 cards; got ${cardTokens.length}`,
    )
  }

  return {
    position: posToken,
    cards: [cardTokens[0], cardTokens[1]],
  }
}

/**
 * Parse a single action segment like "H r 15" or "BB c" or "V x".
 * `segText`       – trimmed action text
 * `segAbsStart`   – absolute offset of segText[0] in raw
 */
function parseAction(segText: string, segAbsStart: number): Action {
  const parts = segText.trim().split(/\s+/)
  if (parts.length < 2) {
    throw new Error(`Malformed action "${segText}": expected actor verb [amount]`)
  }

  const [actorStr, verbStr, ...rest] = parts

  // --- actor ---
  if (!VALID_POSITIONS.has(actorStr)) {
    throw new Error(`Unknown actor "${actorStr}" in action "${segText}"`)
  }
  const actorLocalIdx = segText.indexOf(actorStr)
  const actorAbsStart = segAbsStart + actorLocalIdx
  const actorToken = makeToken(
    actorStr as Position,
    actorAbsStart,
    actorAbsStart + actorStr.length,
  )

  // --- verb ---
  if (!VALID_VERBS.has(verbStr)) {
    throw new Error(`Unknown verb "${verbStr}" in action "${segText}"`)
  }
  const verbLocalIdx = segText.indexOf(verbStr, actorLocalIdx + actorStr.length)
  const verbAbsStart = segAbsStart + verbLocalIdx
  const verbToken = makeToken(
    verbStr as Verb,
    verbAbsStart,
    verbAbsStart + verbStr.length,
  )

  // --- amount ---
  if (AMOUNT_VERBS.has(verbStr)) {
    if (rest.length === 0) {
      throw new Error(
        `Verb "${verbStr}" requires an amount in action "${segText}"`,
      )
    }
    const amountStr = rest[0]
    const amount = Number(amountStr)
    if (!Number.isFinite(amount)) {
      throw new Error(
        `Invalid amount "${amountStr}" in action "${segText}"`,
      )
    }
    const amtLocalIdx = segText.indexOf(amountStr, verbLocalIdx + verbStr.length)
    const amtAbsStart = segAbsStart + amtLocalIdx
    const amtToken = makeToken(amount, amtAbsStart, amtAbsStart + amountStr.length)
    return { actor: actorToken, verb: verbToken, amount: amtToken }
  }

  return { actor: actorToken, verb: verbToken }
}

/**
 * "Flop: BB x, H b 20, BB c"  →  Street
 */
function parseStreetLine(line: string, lineStart: number): Street {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed street line: "${line}"`)

  const nameStr = line.slice(0, colonIdx).trim()
  if (!STREET_NAMES.has(nameStr)) {
    throw new Error(`Unknown street name "${nameStr}"`)
  }

  const afterColon = line.slice(colonIdx + 1)
  // split on commas, track offsets
  const actions: Action[] = []

  // We need to split on ',' and keep track of where each segment starts
  let searchFrom = 0
  for (const segment of afterColon.split(',')) {
    const localIdx = afterColon.indexOf(segment, searchFrom)
    const absStart = lineStart + colonIdx + 1 + localIdx
    const trimmed = segment.trim()
    if (trimmed !== '') {
      // The trimmed text starts later within segment
      const trimOffset =
        absStart + (segment.length - segment.trimStart().length)
      actions.push(parseAction(trimmed, trimOffset))
    }
    searchFrom = localIdx + segment.length
  }

  if (actions.length === 0) {
    throw new Error(`Street "${nameStr}" has no actions`)
  }

  return { name: nameStr as StreetName, actions }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse a raw hand string into a HandAST.
 *
 * Error policy:
 * - Throws a descriptive Error for any structural issue:
 *   missing/wrong lines, unknown tokens, bad card codes, missing amounts.
 * - Token IDs are counter-based and deterministic within one call (reset
 *   each time parseHand is called).
 */
export function parseHand(raw: string): HandAST {
  resetIdCounter()

  if (!raw || raw.trim() === '') {
    throw new Error('Input is empty')
  }

  const state = buildState(raw)

  // Skip leading blank lines
  while (
    state.lineIndex < state.lines.length &&
    state.lines[state.lineIndex].text.trim() === ''
  ) {
    state.lineIndex++
  }

  let stakes: StakesLine | undefined
  let board: BoardLine | undefined
  let hero: HeroLine | undefined
  const streets: Street[] = []

  while (state.lineIndex < state.lines.length) {
    const line = currentLine(state)!
    const trimmed = line.text.trim()

    if (trimmed === '') {
      advanceLine(state)
      continue
    }

    if (trimmed.startsWith('[Stakes:')) {
      stakes = parseStakesLine(line.text, line.start)
      advanceLine(state)
    } else if (trimmed.startsWith('Board:')) {
      board = parseBoardLine(line.text, line.start)
      advanceLine(state)
    } else if (trimmed.startsWith('Hero:')) {
      hero = parseHeroLine(line.text, line.start)
      advanceLine(state)
    } else if (STREET_NAMES.has(trimmed.split(':')[0])) {
      streets.push(parseStreetLine(line.text, line.start))
      advanceLine(state)
    } else {
      throw new Error(`Unrecognised line: "${trimmed}"`)
    }
  }

  if (board === undefined) {
    throw new Error('Missing Board line')
  }
  if (hero === undefined) {
    throw new Error('Missing Hero line')
  }
  if (streets.length === 0) {
    throw new Error('Missing at least one street')
  }

  return {
    id: crypto.randomUUID(),
    stakes,
    board,
    hero,
    streets,
    raw,
  }
}
