export type Suit = 's' | 'h' | 'd' | 'c'

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

/** Character offsets [start, end) in the raw hand string */
export interface Span {
  start: number
  end: number
}

/** A typed value with a stable id and source location */
export interface Token<T> {
  id: string
  value: T
  span: Span
}

export type Position =
  | 'H'
  | 'V'
  | 'V2'
  | 'V3'
  | 'UTG'
  | 'UTG+1'
  | 'UTG+2'
  | 'HJ'
  | 'CO'
  | 'BTN'
  | 'SB'
  | 'BB'
  | 'EP'
  | 'MP'

/** x=check, c=call, r=raise, f=fold, b=bet */
export type Verb = 'x' | 'c' | 'r' | 'f' | 'b'

export interface Action {
  actor: Token<Position>
  verb: Token<Verb>
  amount?: Token<number>
}

export type StreetName = 'Preflop' | 'Flop' | 'Turn' | 'River'

export interface Street {
  name: StreetName
  actions: Action[]
}

/** The full stakes text after "Stakes:" */
export interface StakesLine {
  raw: Token<string>
}

/** 0, 3, 4, or 5 community cards */
export interface BoardLine {
  cards: Token<Card>[]
}

export interface HeroLine {
  position: Token<Position>
  cards: [Token<Card>, Token<Card>]
}

export interface HandAST {
  id: string
  stakes?: StakesLine
  board: BoardLine
  hero: HeroLine
  streets: Street[]
  raw: string
}

export type SuggestionMode =
  | 'AWAIT_BOARD'
  | 'AWAIT_HERO_POS'
  | 'AWAIT_HERO_CARDS'
  | 'AWAIT_ACTOR'
  | 'AWAIT_VERB'
  | 'AWAIT_AMOUNT'

export interface SuggestionContext {
  street?: StreetName
  actor?: string
  facingBet?: boolean
  canAdvance?: boolean
  canSave?: boolean
}

export interface SuggestionResult {
  mode: SuggestionMode
  options: string[]
  context?: SuggestionContext
}
