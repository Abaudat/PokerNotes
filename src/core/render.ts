import { formatCard, SUIT_GLYPHS } from './cards'
import { computePotAtStreetStart, markerFor, markerLabel } from './engine'
import type { HandState, Position, StreetName, Verb, Card, Marker } from './types'

export const HERO_COLOR = '#d4ab5a'
/** Distinct colour for the lone villain's marked seat. */
export const VILLAIN_COLOR = '#929daf'

export const POSITION_COLORS: Record<Position, string> = {
  UTG: '#c96a60',
  'UTG+1': '#cd8a55',
  'UTG+2': '#a8b35c',
  'UTG+3': '#82b56e',
  HJ: '#5fae7e',
  CO: '#58a9ba',
  BTN: '#6d9ee0',
  SB: '#9b85d6',
  BB: '#cd7ba8',
  EP: '#5cb5a2',
  MP: '#b189d3',
}

function actorColor(position: string): string {
  return POSITION_COLORS[position as Position] ?? VILLAIN_COLOR
}

/** Colour for a seat, honouring its derived hero/villain marker. */
function markedColor(position: string, marker?: Marker): string {
  if (marker === 'H') return HERO_COLOR
  if (marker === 'V') return VILLAIN_COLOR
  return actorColor(position)
}

// ===========================================================================
// HandViewModel — read-only presentation of a saved hand (HandView)
// ===========================================================================

export interface ActionViewModel {
  id: string
  actor: string
  /** Display label honouring the hero/villain marker, e.g. "H (SB)" / "V (BB)" */
  label: string
  marker?: Marker
  verb: Verb
  amount?: number
  isHero: boolean
  isVillain: boolean
  color: string
}

export interface StreetViewModel {
  name: StreetName
  potAtStart: number
  actions: ActionViewModel[]
}

export interface HeroViewModel {
  position: string
  cards: [string, string]
  isHero: true
  label: 'HERO'
  color: string
}

export interface ShowdownActionViewModel {
  id: string
  actor: string
  label: string
  marker?: Marker
  verb: string
  cards?: [string, string]
  isHero: boolean
  isVillain: boolean
  color: string
}

export interface HandViewModel {
  stakes?: string
  board: string[]
  hero: HeroViewModel
  streets: StreetViewModel[]
  showdown?: ShowdownActionViewModel[]
  showdownPot?: number
}

export function buildHandViewModel(state: HandState): HandViewModel {
  const board = (state.board ?? []).map(formatCard)

  const heroPosition = state.hero?.position ?? ''
  const heroCards: [string, string] = state.hero?.cards
    ? [formatCard(state.hero.cards[0]), formatCard(state.hero.cards[1])]
    : ['', '']

  const hero: HeroViewModel = {
    position: heroPosition,
    cards: heroCards,
    isHero: true,
    label: 'HERO',
    color: HERO_COLOR,
  }

  const streets: StreetViewModel[] = state.streets.map((street, i) => ({
    name: street.name,
    potAtStart: computePotAtStreetStart(state, i),
    actions: street.actions.map((action) => {
      const marker = markerFor(state, action.actor)
      const vm: ActionViewModel = {
        id: action.id,
        actor: action.actor,
        label: markerLabel(action.actor, marker),
        verb: action.verb ?? 'x',
        isHero: marker === 'H',
        isVillain: marker === 'V',
        color: markedColor(action.actor, marker),
      }
      if (marker) vm.marker = marker
      if (action.amount !== undefined) vm.amount = action.amount
      return vm
    }),
  }))

  const showdown = state.showdown
    ? state.showdown.map((sa) => {
        const marker = markerFor(state, sa.actor)
        const vm: ShowdownActionViewModel = {
          id: sa.id,
          actor: sa.actor,
          label: markerLabel(sa.actor, marker),
          verb: sa.verb ?? '',
          isHero: marker === 'H',
          isVillain: marker === 'V',
          color: markedColor(sa.actor, marker),
        }
        if (marker) vm.marker = marker
        if (sa.cards) vm.cards = [formatCard(sa.cards[0]), formatCard(sa.cards[1])]
        return vm
      })
    : undefined

  const showdownPot =
    state.showdown !== undefined
      ? computePotAtStreetStart(state, state.streets.length)
      : undefined

  return { stakes: state.stakes, board, hero, streets, showdown, showdownPot }
}

// ===========================================================================
// Editor view — interactive chips driven by the model (replaces recordingView)
// ===========================================================================

export type ChipKind =
  | 'stakes'
  | 'board-card'
  | 'board-card-add'
  | 'hero-pos'
  | 'hero-card'
  | 'action'
  | 'showdown-actor'
  | 'showdown-verb'
  | 'showdown-card'
  | 'note'
  | 'label'

export type EditKind =
  | 'board-card'
  | 'board-card-add'
  | 'hero-pos'
  | 'hero-card'
  | 'action'
  | 'showdown-actor'
  | 'showdown-verb'
  | 'showdown-card'
  | 'stakes'
  | 'note'
  | null

export interface ChipMeta {
  cardCode?: string
  verb?: Verb
  amount?: number
  actor?: string
  marker?: Marker
  /** Two-tone rendering of a merged action chip: seat-coloured part… */
  actorLabel?: string
  /** …and muted conjugated-verb part, e.g. "raises 15". */
  verbText?: string
}

export interface Chip {
  id: string
  kind: ChipKind
  text: string
  editKind: EditKind
  /** locators for engine edit ops */
  street?: StreetName
  index?: number
  cardIndex?: number
  noteId?: string
  meta?: ChipMeta
}

export interface ChipLine {
  key: string
  chips: Chip[]
}

const VERB_CHIP_WORDS: Record<Verb, string> = {
  x: 'checks',
  c: 'calls',
  r: 'raises',
  f: 'folds',
  b: 'bets',
  a: 'all in',
}

const SHOWDOWN_VERB_LABELS: Record<string, string> = {
  shows: 'Shows',
  wins: 'Wins',
  loses: 'Loses',
}

function cardText(card: Card): string {
  return card.rank + SUIT_GLYPHS[card.suit]
}

function cardCode(card: Card): string {
  return card.rank + card.suit
}

export function buildEditorView(state: HandState): ChipLine[] {
  const lines: ChipLine[] = []

  // Notes are rendered after the section they are anchored to.
  const noteLine = (anchor: string) => {
    state.notes.forEach((note, i) => {
      if (note.anchor !== anchor) return
      lines.push({
        key: `note:${i}`,
        chips: [
          {
            id: `note:${i}`,
            kind: 'note',
            text: `# ${note.text}`,
            editKind: 'note',
            noteId: note.id,
            meta: { actor: undefined },
          },
        ],
      })
    })
  }

  noteLine('top')

  if (state.stakes !== undefined) {
    lines.push({
      key: 'stakes',
      chips: [{ id: 'stakes', kind: 'stakes', text: state.stakes, editKind: 'stakes' }],
    })
    noteLine('stakes')
  }

  if (state.board !== undefined) {
    const cardChips: Chip[] = state.board.map((card, i) => ({
      id: `board:${i}`,
      kind: 'board-card',
      text: cardText(card),
      editKind: 'board-card',
      cardIndex: i,
      meta: { cardCode: cardCode(card) },
    }))
    const addChip: Chip[] =
      state.board.length < 5
        ? [{ id: 'board:add', kind: 'board-card-add', text: '+', editKind: 'board-card-add' }]
        : []
    if (state.board.length === 0) {
      lines.push({
        key: 'board:empty',
        chips: [
          { id: 'board:empty-label', kind: 'label', text: 'No board', editKind: null },
          ...addChip,
        ],
      })
    } else {
      lines.push({ key: 'board', chips: [...cardChips, ...addChip] })
    }
    noteLine('board')
  }

  if (state.hero !== undefined) {
    const chips: Chip[] = [
      {
        id: 'hero:pos',
        kind: 'hero-pos',
        text: markerLabel(state.hero.position, 'H'),
        editKind: 'hero-pos',
        meta: { actor: state.hero.position, marker: 'H' },
      },
    ]
    if (state.hero.cards) {
      state.hero.cards.forEach((card, i) => {
        chips.push({
          id: `hero:card:${i}`,
          kind: 'hero-card',
          text: cardText(card),
          editKind: 'hero-card',
          cardIndex: i,
          meta: { cardCode: cardCode(card) },
        })
      })
    }
    lines.push({ key: 'hero', chips })
    noteLine('hero')
  }

  for (let si = 0; si < state.streets.length; si++) {
    const street = state.streets[si]
    if (street.name !== 'Preflop') {
      const pot = computePotAtStreetStart(state, si)
      lines.push({
        key: `pot:${street.name}`,
        chips: [
          {
            id: `pot:${street.name}`,
            kind: 'label',
            text: `Pot: ${pot}`,
            editKind: null,
          },
        ],
      })
    }
    const chips: Chip[] = []
    street.actions.forEach((action, i) => {
      const marker = markerFor(state, action.actor)
      const label = markerLabel(action.actor, marker)
      let verbText: string | undefined
      if (action.verb !== undefined) {
        const word = VERB_CHIP_WORDS[action.verb]
        verbText = action.amount !== undefined ? `${word} ${action.amount}` : word
      }
      chips.push({
        id: `action:${street.name}:${i}`,
        kind: 'action',
        text: verbText !== undefined ? `${label} ${verbText}` : label,
        editKind: 'action',
        street: street.name,
        index: i,
        meta: {
          actor: action.actor,
          marker,
          verb: action.verb,
          amount: action.amount,
          actorLabel: label,
          verbText,
        },
      })
    })
    if (chips.length > 0) lines.push({ key: `street:${street.name}`, chips })
    noteLine(street.name)
  }

  if (state.showdown !== undefined) {
    const showdownPot = computePotAtStreetStart(state, state.streets.length)
    lines.push({
      key: 'pot:showdown',
      chips: [
        {
          id: 'pot:showdown',
          kind: 'label',
          text: `Pot: ${showdownPot}`,
          editKind: null,
        },
      ],
    })
  }

  if (state.showdown !== undefined) {
    const chips: Chip[] = []
    state.showdown.forEach((entry, i) => {
      const marker = markerFor(state, entry.actor)
      chips.push({
        id: `showdown:${i}:actor`,
        kind: 'showdown-actor',
        text: markerLabel(entry.actor, marker),
        editKind: 'showdown-actor',
        index: i,
        meta: { actor: entry.actor, marker },
      })
      if (entry.verb !== undefined) {
        chips.push({
          id: `showdown:${i}:verb`,
          kind: 'showdown-verb',
          text: SHOWDOWN_VERB_LABELS[entry.verb] ?? entry.verb,
          editKind: 'showdown-verb',
          index: i,
          meta: { actor: entry.actor },
        })
        if (entry.verb === 'shows' && entry.cards) {
          entry.cards.forEach((card, j) => {
            chips.push({
              id: `showdown:${i}:card:${j}`,
              kind: 'showdown-card',
              text: cardText(card),
              editKind: 'showdown-card',
              index: i,
              cardIndex: j,
              meta: { cardCode: cardCode(card), actor: entry.actor },
            })
          })
        }
      }
    })
    if (chips.length > 0) lines.push({ key: 'showdown', chips })
    noteLine('showdown')
  }

  return lines
}
