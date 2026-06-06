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
  | 'UTG+3'
  | 'HJ'
  | 'CO'
  | 'BTN'
  | 'SB'
  | 'BB'
  | 'EP'
  | 'MP'

/** x=check, c=call, r=raise, f=fold, b=bet, a=all-in */
export type Verb = 'x' | 'c' | 'r' | 'f' | 'b' | 'a'

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

/** 0, 3, 4, or 5 community cards */
export interface BoardLine {
  cards: Token<Card>[]
}

export interface HeroLine {
  position: Token<Position>
  cards: [Token<Card>, Token<Card>]
}

/** The full stakes text after "Stakes:" */
export interface StakesLine {
  raw: Token<string>
}

// ---------------------------------------------------------------------------
// Showdown
// ---------------------------------------------------------------------------

export type ShowdownVerb = 'shows' | 'wins' | 'loses'

export interface ShowdownAction {
  actor: Token<Position>
  verb: Token<ShowdownVerb>
  /** Only present when verb = 'shows' */
  cards?: [Token<Card>, Token<Card>]
}

export interface ShowdownLine {
  actions: ShowdownAction[]
}

// ---------------------------------------------------------------------------
// Hand AST
// ---------------------------------------------------------------------------

export interface HandAST {
  id: string
  stakes?: StakesLine
  board: BoardLine
  hero: HeroLine
  streets: Street[]
  showdown?: ShowdownLine
  raw: string
}

// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

export type SuggestionMode =
  | 'AWAIT_BOARD'
  | 'AWAIT_HERO_POS'
  | 'AWAIT_HERO_CARDS'
  | 'AWAIT_ACTOR'
  | 'AWAIT_VERB'
  | 'AWAIT_AMOUNT'
  | 'AWAIT_AMOUNT_OPT'
  | 'AWAIT_SHOWDOWN_ACTOR'
  | 'AWAIT_SHOWDOWN_VERB'
  | 'AWAIT_SHOWDOWN_CARDS'

export interface SuggestionContext {
  street?: StreetName
  actor?: string
  facingBet?: boolean
  canAdvance?: boolean
  canSave?: boolean
  canShowdown?: boolean
}

export interface SuggestionResult {
  mode: SuggestionMode
  options: string[]
  context?: SuggestionContext
}
