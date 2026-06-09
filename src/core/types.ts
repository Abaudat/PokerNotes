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

export type Position =
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

/**
 * A derived role marker shown alongside a position (never stored on the model).
 * 'H' = hero's seat; 'V' = the single villain when the hand is heads-up by the flop.
 */
export type Marker = 'H' | 'V'

/** x=check, c=call, r=raise, f=fold, b=bet, a=all-in */
export type Verb = 'x' | 'c' | 'r' | 'f' | 'b' | 'a'

export type StreetName = 'Preflop' | 'Flop' | 'Turn' | 'River'

// ---------------------------------------------------------------------------
// Semantic hand model (HandState) — the source of truth in the editor.
// No spans: the editor renders directly from this model and maps UI elements
// back to nodes positionally (street + index) or by stable node id.
// During recording the model may be PARTIAL (board/hero unset, a trailing
// action without a verb). serializeHand / presentation assume a complete state.
// ---------------------------------------------------------------------------

export interface Action {
  id: string
  actor: Position
  /** undefined only for the trailing in-progress action while recording */
  verb?: Verb
  amount?: number
}

export interface Street {
  name: StreetName
  actions: Action[]
}

export type ShowdownVerb = 'shows' | 'wins' | 'loses'

export interface ShowdownEntry {
  id: string
  actor: Position
  /** undefined only for the trailing in-progress entry while recording */
  verb?: ShowdownVerb
  /** Only present when verb = 'shows' */
  cards?: [Card, Card]
}

/** Where a free-text note sits in the serialized timeline (the section it follows) */
export type NoteAnchor =
  | 'top'
  | 'stakes'
  | 'board'
  | 'hero'
  | 'Preflop'
  | 'Flop'
  | 'Turn'
  | 'River'
  | 'showdown'

export interface Note {
  id: string
  text: string
  anchor: NoteAnchor
}

export interface Hero {
  position: Position
  /** undefined while the position has been chosen but cards are still pending */
  cards?: [Card, Card]
}

export interface HandState {
  id: string
  stakes?: string
  /** undefined until the board step is answered; then 0 | 3 | 4 | 5 cards */
  board?: Card[]
  hero?: Hero
  streets: Street[]
  showdown?: ShowdownEntry[]
  notes: Note[]
}

// ---------------------------------------------------------------------------
// Engine: next-step suggestion driver
// ---------------------------------------------------------------------------

export type NextStep =
  | { kind: 'board' }
  | { kind: 'heroPosition'; options: Position[] }
  | { kind: 'heroCards' }
  | {
      kind: 'actor'
      street: StreetName
      options: Position[]
      canAdvance: boolean
      canShowdown: boolean
      canSave: boolean
    }
  | { kind: 'verb'; street: StreetName; actor: Position; options: Verb[]; facingBet: boolean; bbOption: boolean }
  | { kind: 'amount'; street: StreetName; actor: Position; optional: boolean }
  | { kind: 'showdownActor'; options: Position[]; canSave: boolean }
  | { kind: 'showdownVerb'; actor: Position }
  | { kind: 'showdownCards'; actor: Position }
