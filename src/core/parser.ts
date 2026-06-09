import { parseCard } from './cards'
import type {
  HandState,
  Hero,
  Street,
  Action,
  ShowdownEntry,
  ShowdownVerb,
  Card,
  Position,
  Verb,
  StreetName,
  Note,
  NoteAnchor,
} from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_POSITIONS = new Set<string>([
  'UTG',
  'UTG+1',
  'UTG+2',
  'UTG+3',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
  'EP',
  'MP',
])

const VALID_VERBS = new Set<string>(['x', 'c', 'r', 'f', 'b', 'a'])
const AMOUNT_VERBS = new Set<string>(['r', 'b'])
const OPTIONAL_AMOUNT_VERBS = new Set<string>(['a'])
const STREET_NAMES = new Set<string>(['Preflop', 'Flop', 'Turn', 'River'])
const SHOWDOWN_VERBS = new Set<string>(['shows', 'wins', 'loses'])

// ---------------------------------------------------------------------------
// Counter-based node IDs (deterministic within one parse call)
// ---------------------------------------------------------------------------

let _idCounter = 0

function nextId(): string {
  return `node_${++_idCounter}`
}

function resetIdCounter(): void {
  _idCounter = 0
}

// ---------------------------------------------------------------------------
// Card parsing (packed / space-separated / mixed)
// ---------------------------------------------------------------------------

function parseCards(text: string): Card[] {
  const cards: Card[] = []
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++
      continue
    }
    if (i + 1 >= text.length) {
      throw new Error(`Incomplete card code: "${text.slice(i)}"`)
    }
    const code = text[i] + text[i + 1]
    const card = parseCard(code)
    if (card === null) {
      throw new Error(`Invalid card code "${code}"`)
    }
    cards.push(card)
    i += 2
  }
  return cards
}

// ---------------------------------------------------------------------------
// Line parsers
// ---------------------------------------------------------------------------

function parseStakesLine(line: string): string {
  const match = /^\[Stakes:(.*)\]$/.exec(line.trim())
  if (!match) {
    throw new Error(`Malformed Stakes line: "${line}"`)
  }
  return match[1].trim()
}

function parseBoardLine(line: string): Card[] {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed Board line: "${line}"`)
  const cards = parseCards(line.slice(colonIdx + 1))
  if (cards.length !== 0 && cards.length !== 3 && cards.length !== 4 && cards.length !== 5) {
    throw new Error(`Board must have 0, 3, 4, or 5 cards; got ${cards.length}`)
  }
  return cards
}

function parseHeroLine(line: string): Hero {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed Hero line: "${line}"`)
  const afterColon = line.slice(colonIdx + 1).trim()
  const tokens = afterColon.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) {
    throw new Error(`Hero line must have position and 2 cards; got: "${afterColon}"`)
  }

  const posStr = tokens[0]
  if (!VALID_POSITIONS.has(posStr)) {
    throw new Error(`Unknown position "${posStr}" in Hero line`)
  }

  const cards = parseCards(tokens.slice(1).join(''))
  if (cards.length !== 2) {
    throw new Error(`Hero line must have exactly 2 cards; got ${cards.length}`)
  }

  return { position: posStr as Position, cards: [cards[0], cards[1]] }
}

function parseAction(segText: string): Action {
  const parts = segText.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) {
    throw new Error(`Malformed action "${segText}": expected actor verb [amount]`)
  }

  const actorStr = parts[0]
  if (!VALID_POSITIONS.has(actorStr)) {
    throw new Error(`Unknown actor "${actorStr}" in action "${segText}"`)
  }
  const actor = actorStr as Position

  // Accept "all in" (canonical) and single 'a' (legacy)
  let verb: Verb
  let restParts: string[]
  if (parts[1] === 'all' && parts.length >= 3 && parts[2] === 'in') {
    verb = 'a'
    restParts = parts.slice(3)
  } else {
    const verbStr = parts[1]
    if (!VALID_VERBS.has(verbStr)) {
      throw new Error(`Unknown verb "${verbStr}" in action "${segText}"`)
    }
    verb = verbStr as Verb
    restParts = parts.slice(2)
  }

  if (AMOUNT_VERBS.has(verb)) {
    if (restParts.length === 0) {
      throw new Error(`Verb "${verb}" requires an amount in action "${segText}"`)
    }
    const amount = Number(restParts[0])
    if (!Number.isFinite(amount)) {
      throw new Error(`Invalid amount "${restParts[0]}" in action "${segText}"`)
    }
    return { id: nextId(), actor, verb, amount }
  }

  if (OPTIONAL_AMOUNT_VERBS.has(verb) && restParts.length > 0) {
    const amount = Number(restParts[0])
    if (Number.isFinite(amount)) {
      return { id: nextId(), actor, verb, amount }
    }
  }

  return { id: nextId(), actor, verb }
}

function parseStreetLine(line: string): Street {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed street line: "${line}"`)

  const nameStr = line.slice(0, colonIdx).trim()
  if (!STREET_NAMES.has(nameStr)) {
    throw new Error(`Unknown street name "${nameStr}"`)
  }

  const actions: Action[] = []
  for (const segment of line.slice(colonIdx + 1).split(',')) {
    const trimmed = segment.trim()
    if (trimmed !== '') actions.push(parseAction(trimmed))
  }

  if (actions.length === 0) {
    throw new Error(`Street "${nameStr}" has no actions`)
  }

  return { name: nameStr as StreetName, actions }
}

function parseShowdownAction(segText: string): ShowdownEntry {
  const parts = segText.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) {
    throw new Error(`Malformed showdown action "${segText}": expected position verb [cards]`)
  }

  const [actorStr, verbStr] = parts
  if (!VALID_POSITIONS.has(actorStr)) {
    throw new Error(`Unknown position "${actorStr}" in showdown action`)
  }
  if (!SHOWDOWN_VERBS.has(verbStr)) {
    throw new Error(`Unknown showdown verb "${verbStr}"`)
  }

  if (verbStr === 'shows') {
    const cards = parseCards(parts.slice(2).join(''))
    if (cards.length !== 2) {
      throw new Error(`Showdown "shows" must be followed by exactly 2 cards; got ${cards.length}`)
    }
    return { id: nextId(), actor: actorStr as Position, verb: 'shows', cards: [cards[0], cards[1]] }
  }

  return { id: nextId(), actor: actorStr as Position, verb: verbStr as ShowdownVerb }
}

function parseShowdownLine(line: string): ShowdownEntry[] {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) throw new Error(`Malformed Showdown line: "${line}"`)

  const entries: ShowdownEntry[] = []
  for (const segment of line.slice(colonIdx + 1).split(',')) {
    const trimmed = segment.trim()
    if (trimmed !== '') entries.push(parseShowdownAction(trimmed))
  }

  if (entries.length === 0) {
    throw new Error('Showdown line has no actions')
  }

  return entries
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function parseHand(raw: string): HandState {
  resetIdCounter()

  if (!raw || raw.trim() === '') {
    throw new Error('Input is empty')
  }

  let stakes: string | undefined
  let board: Card[] | undefined
  let hero: Hero | undefined
  let showdown: ShowdownEntry[] | undefined
  const streets: Street[] = []
  const notes: Note[] = []

  // Track which serialized section the most recent line belongs to, so a `#`
  // note line can be anchored to the section it follows.
  let anchor: NoteAnchor = 'top'

  for (const rawLine of raw.split('\n')) {
    const trimmed = rawLine.trim()
    if (trimmed === '') continue

    if (trimmed.startsWith('#')) {
      const text = trimmed.slice(1).trim()
      notes.push({ id: nextId(), text, anchor })
    } else if (trimmed.startsWith('[Stakes:')) {
      stakes = parseStakesLine(rawLine)
      anchor = 'stakes'
    } else if (trimmed.startsWith('Board:')) {
      board = parseBoardLine(rawLine)
      anchor = 'board'
    } else if (trimmed.startsWith('Hero:')) {
      hero = parseHeroLine(rawLine)
      anchor = 'hero'
    } else if (trimmed.startsWith('Showdown:')) {
      showdown = parseShowdownLine(rawLine)
      anchor = 'showdown'
    } else if (STREET_NAMES.has(trimmed.split(':')[0])) {
      const street = parseStreetLine(rawLine)
      streets.push(street)
      anchor = street.name
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
    showdown,
    notes,
  }
}
