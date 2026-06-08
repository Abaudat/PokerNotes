import { formatCard, SUIT_GLYPHS } from './cards'
import type { HandState, Position, StreetName, Verb, Card } from './types'

export const HERO_COLOR = '#f59e0b'

export const POSITION_COLORS: Record<Exclude<Position, 'H'>, string> = {
  V: '#6b7280',
  V2: '#9ca3af',
  V3: '#d1d5db',
  UTG: '#ef4444',
  'UTG+1': '#f97316',
  'UTG+2': '#eab308',
  'UTG+3': '#84cc16',
  HJ: '#22c55e',
  CO: '#06b6d4',
  BTN: '#3b82f6',
  SB: '#8b5cf6',
  BB: '#ec4899',
  EP: '#14b8a6',
  MP: '#a855f7',
}

function actorColor(position: string): string {
  if (position === 'H') return HERO_COLOR
  return POSITION_COLORS[position as Exclude<Position, 'H'>] ?? '#6b7280'
}

// ===========================================================================
// HandViewModel — read-only presentation of a saved hand (HandView)
// ===========================================================================

export interface ActionViewModel {
  id: string
  actor: string
  verb: Verb
  amount?: number
  isHero: boolean
  color: string
}

export interface StreetViewModel {
  name: StreetName
  actions: ActionViewModel[]
}

export interface HeroViewModel {
  position: Position
  cards: [string, string]
  isHero: true
  label: 'HERO'
  color: string
}

export interface ShowdownActionViewModel {
  id: string
  actor: string
  verb: string
  cards?: [string, string]
  isHero: boolean
  color: string
}

export interface HandViewModel {
  stakes?: string
  board: string[]
  hero: HeroViewModel
  streets: StreetViewModel[]
  showdown?: ShowdownActionViewModel[]
}

export function buildHandViewModel(state: HandState): HandViewModel {
  const board = (state.board ?? []).map(formatCard)

  const heroPosition = state.hero?.position ?? 'H'
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

  const streets: StreetViewModel[] = state.streets.map((street) => ({
    name: street.name,
    actions: street.actions.map((action) => {
      const vm: ActionViewModel = {
        id: action.id,
        actor: action.actor,
        verb: action.verb ?? 'x',
        isHero: action.actor === 'H',
        color: actorColor(action.actor),
      }
      if (action.amount !== undefined) vm.amount = action.amount
      return vm
    }),
  }))

  const showdown = state.showdown
    ? state.showdown.map((sa) => {
        const vm: ShowdownActionViewModel = {
          id: sa.id,
          actor: sa.actor,
          verb: sa.verb ?? '',
          isHero: sa.actor === 'H',
          color: actorColor(sa.actor),
        }
        if (sa.cards) vm.cards = [formatCard(sa.cards[0]), formatCard(sa.cards[1])]
        return vm
      })
    : undefined

  return { stakes: state.stakes, board, hero, streets, showdown }
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
  | 'action-actor'
  | 'action-verb'
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
  | 'actor'
  | 'verb'
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

const VERB_LABELS: Record<Verb, string> = {
  x: 'Check',
  c: 'Call',
  r: 'Raise',
  f: 'Fold',
  b: 'Bet',
  a: 'All In',
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

function verbChipText(verb: Verb, amount?: number): string {
  const label = VERB_LABELS[verb]
  if (amount === undefined) return label
  return `${label} ${amount}`
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
        text: state.hero.position,
        editKind: 'hero-pos',
        meta: { actor: state.hero.position },
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

  for (const street of state.streets) {
    const chips: Chip[] = []
    street.actions.forEach((action, i) => {
      chips.push({
        id: `action:${street.name}:${i}:actor`,
        kind: 'action-actor',
        text: action.actor,
        editKind: 'actor',
        street: street.name,
        index: i,
        meta: { actor: action.actor },
      })
      if (action.verb !== undefined) {
        chips.push({
          id: `action:${street.name}:${i}:verb`,
          kind: 'action-verb',
          text: verbChipText(action.verb, action.amount),
          editKind: 'verb',
          street: street.name,
          index: i,
          meta: { verb: action.verb, amount: action.amount, actor: action.actor },
        })
      }
    })
    if (chips.length > 0) lines.push({ key: `street:${street.name}`, chips })
    noteLine(street.name)
  }

  if (state.showdown !== undefined) {
    const chips: Chip[] = []
    state.showdown.forEach((entry, i) => {
      chips.push({
        id: `showdown:${i}:actor`,
        kind: 'showdown-actor',
        text: entry.actor,
        editKind: 'showdown-actor',
        index: i,
        meta: { actor: entry.actor },
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
