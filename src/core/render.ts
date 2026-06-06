import { formatCard } from './cards'
import type { HandAST, Position, StreetName, Verb } from './types'

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

function actorColor(position: string): string {
  if (position === 'H') return HERO_COLOR
  return POSITION_COLORS[position as Exclude<Position, 'H'>] ?? '#6b7280'
}

export function buildHandViewModel(ast: HandAST): HandViewModel {
  const board = ast.board.cards.map((t) => formatCard(t.value))

  const hero: HeroViewModel = {
    position: ast.hero.position.value,
    cards: [formatCard(ast.hero.cards[0].value), formatCard(ast.hero.cards[1].value)],
    isHero: true,
    label: 'HERO',
    color: HERO_COLOR,
  }

  const streets: StreetViewModel[] = ast.streets.map((street) => ({
    name: street.name,
    actions: street.actions.map((action) => {
      const actor = action.actor.value
      const vm: ActionViewModel = {
        id: action.actor.id,
        actor,
        verb: action.verb.value,
        isHero: actor === 'H',
        color: actorColor(actor),
      }
      if (action.amount !== undefined) {
        vm.amount = action.amount.value
      }
      return vm
    }),
  }))

  const showdown = ast.showdown
    ? ast.showdown.actions.map((sa) => {
        const actor = sa.actor.value
        const vm: ShowdownActionViewModel = {
          id: sa.actor.id,
          actor,
          verb: sa.verb.value,
          isHero: actor === 'H',
          color: actorColor(actor),
        }
        if (sa.cards) {
          vm.cards = [formatCard(sa.cards[0].value), formatCard(sa.cards[1].value)]
        }
        return vm
      })
    : undefined

  return { stakes: ast.stakes?.raw.value, board, hero, streets, showdown }
}
