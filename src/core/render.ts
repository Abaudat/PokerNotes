import { formatCard } from './cards'
import type { HandAST, Position, StreetName, Verb } from './types'

export const HERO_COLOR = '#f59e0b' // amber-400 — strong accent for Hero

export const POSITION_COLORS: Record<Exclude<Position, 'H'>, string> = {
  V: '#6b7280',      // gray-500
  V2: '#9ca3af',     // gray-400
  V3: '#d1d5db',     // gray-300
  UTG: '#ef4444',    // red-500
  'UTG+1': '#f97316', // orange-500
  'UTG+2': '#eab308', // yellow-500
  HJ: '#22c55e',     // green-500
  CO: '#06b6d4',     // cyan-500
  BTN: '#3b82f6',    // blue-500
  SB: '#8b5cf6',     // violet-500
  BB: '#ec4899',     // pink-500
  EP: '#14b8a6',     // teal-500
  MP: '#a855f7',     // purple-500
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

export interface HandViewModel {
  stakes?: string
  board: string[]
  hero: HeroViewModel
  streets: StreetViewModel[]
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

  return {
    stakes: ast.stakes?.raw.value,
    board,
    hero,
    streets,
  }
}
