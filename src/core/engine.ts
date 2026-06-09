import type {
  HandState,
  Action,
  Street,
  StreetName,
  Position,
  Verb,
  Card,
  ShowdownVerb,
  NextStep,
  NoteAnchor,
} from './types'

// ---------------------------------------------------------------------------
// Constants — seat ordering and verb classes (single source of truth)
// ---------------------------------------------------------------------------

export const POSITION_ORDER: Position[] = [
  'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'HJ', 'CO', 'BTN', 'SB', 'BB',
]
/** Postflop the blinds act first; the button acts last. */
export const POSTFLOP_POSITION_ORDER: Position[] = [
  'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'HJ', 'CO', 'BTN',
]
export const GENERIC_POSITIONS: Position[] = ['H', 'V', 'V2', 'V3']

/** Seat speaking order for the given street (preflop puts blinds last). */
function orderFor(streetName: StreetName): Position[] {
  return streetName === 'Preflop' ? POSITION_ORDER : POSTFLOP_POSITION_ORDER
}

export const ALL_POSITIONS: Position[] = [
  'H', 'V', 'V2', 'V3', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3',
  'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP',
]

export const HERO_POSITIONS: Position[] = [
  'UTG', 'UTG+1', 'UTG+2', 'UTG+3',
  'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP',
]

const STREET_ORDER: StreetName[] = ['Preflop', 'Flop', 'Turn', 'River']

/** Verbs that re-open the action — everyone else gets another turn */
const REOPENING_VERBS = new Set<Verb>(['r', 'b', 'a'])

// ---------------------------------------------------------------------------
// Node-id generation (unique within an editing session; no reset)
// ---------------------------------------------------------------------------

let _seq = 0
function mkId(): string {
  return `enode_${++_seq}`
}

// ---------------------------------------------------------------------------
// Low-level helpers over Action lists
// ---------------------------------------------------------------------------

/** Actions that carry a verb (a trailing verbless action is "in progress"). */
function completeActions(actions: Action[]): Action[] {
  return actions.filter((a) => a.verb !== undefined)
}

function uniqueActors(actions: Action[]): Position[] {
  const seen = new Set<Position>()
  const out: Position[] = []
  for (const a of actions) {
    if (!seen.has(a.actor)) {
      seen.add(a.actor)
      out.push(a.actor)
    }
  }
  return out
}

function sortPositions(positions: Position[], order: Position[] = POSITION_ORDER): Position[] {
  const set = new Set(positions)
  const generics = GENERIC_POSITIONS.filter((p) => set.has(p))
  const ordered = order.filter((p) => set.has(p))
  const others = positions.filter(
    (p) => !GENERIC_POSITIONS.includes(p) && !order.includes(p),
  )
  return [...generics, ...ordered, ...others]
}

/** True if any of these actions was a bet / raise / all-in. */
export function hasBetOrRaise(actions: Action[]): boolean {
  return actions.some((a) => a.verb !== undefined && REOPENING_VERBS.has(a.verb))
}

/** Players who went all-in in the given actions. */
function allInActorsIn(actions: Action[]): Set<Position> {
  const s = new Set<Position>()
  for (const a of actions) if (a.verb === 'a') s.add(a.actor)
  return s
}

/** All-in actors accumulated from streets before the given street index. */
function allInBeforeStreet(state: HandState, streetIndex: number): Set<Position> {
  const allIn = new Set<Position>()
  for (let i = 0; i < streetIndex && i < state.streets.length; i++) {
    for (const a of completeActions(state.streets[i].actions)) {
      if (a.verb === 'a') allIn.add(a.actor)
    }
  }
  return allIn
}

// ---------------------------------------------------------------------------
// Who may act next on a street
// ---------------------------------------------------------------------------

/**
 * After a re-open (bet/raise/all-in), build the response-order list and apply a
 * "skip = folded" frontier: if an actor later in response order has replied, all
 * earlier non-repliers are treated as folded; suggest only those after the
 * frontier who have not replied.
 */
function buildReopenOptions(
  streetName: StreetName,
  reopener: Position,
  spokenBefore: Position[],
  spokenAfter: Set<Position>,
  preflopActors: Position[],
  cannotAct: Set<Position> = new Set(),
): Position[] {
  const order = orderFor(streetName)
  const reopenerIdx = order.indexOf(reopener)
  const beforeSet = new Set(spokenBefore)

  let responseOrder: Position[]

  if (streetName === 'Preflop') {
    const orderedFirst =
      reopenerIdx === -1
        ? order.filter((p) => !beforeSet.has(p) && !cannotAct.has(p))
        : order.slice(reopenerIdx + 1).filter((p) => !cannotAct.has(p))
    const orderedSecond = order.filter((p) => beforeSet.has(p) && p !== reopener && !cannotAct.has(p))
    const genFirst = GENERIC_POSITIONS.filter((p) => !beforeSet.has(p) && p !== reopener && !cannotAct.has(p))
    const genSecond = GENERIC_POSITIONS.filter((p) => beforeSet.has(p) && p !== reopener && !cannotAct.has(p))
    responseOrder = [...genFirst, ...orderedFirst, ...genSecond, ...orderedSecond]
  } else {
    const orderedFirst = preflopActors.filter((p) => {
      if (p === reopener) return false
      if (cannotAct.has(p)) return false
      const pIdx = order.indexOf(p)
      if (reopenerIdx === -1 || pIdx === -1) return !beforeSet.has(p)
      return pIdx > reopenerIdx
    })
    const orderedSecond = preflopActors.filter((p) => p !== reopener && beforeSet.has(p) && !cannotAct.has(p))
    responseOrder = [...sortPositions(orderedFirst, order), ...sortPositions(orderedSecond, order)]
  }

  let frontierIdx = -1
  for (let i = responseOrder.length - 1; i >= 0; i--) {
    if (spokenAfter.has(responseOrder[i])) {
      frontierIdx = i
      break
    }
  }

  return frontierIdx === -1 ? responseOrder : responseOrder.slice(frontierIdx + 1)
}

/**
 * Positions that may legally act next, given the already-completed actions on
 * the street and the pool of actors active entering it.
 */
export function legalActorsToAct(
  streetName: StreetName,
  completed: Action[],
  preflopActors: Position[],
  alreadyAllIn: Set<Position> = new Set(),
): Position[] {
  const order = orderFor(streetName)
  let lastReopenIdx = -1
  for (let i = completed.length - 1; i >= 0; i--) {
    const v = completed[i].verb
    if (v !== undefined && REOPENING_VERBS.has(v)) {
      lastReopenIdx = i
      break
    }
  }

  // Players who can't act: from prior streets + went all-in in this street before the last reopen
  const cannotAct = new Set<Position>([
    ...alreadyAllIn,
    ...allInActorsIn(lastReopenIdx === -1 ? completed : completed.slice(0, lastReopenIdx)),
  ])

  if (lastReopenIdx !== -1) {
    const reopener = completed[lastReopenIdx].actor
    const beforeReopen = uniqueActors(completed.slice(0, lastReopenIdx))
    const afterReopen = new Set(uniqueActors(completed.slice(lastReopenIdx + 1)))
    return buildReopenOptions(streetName, reopener, beforeReopen, afterReopen, preflopActors, cannotAct)
  }

  const spokenSet = new Set(uniqueActors(completed))
  const lastActor = completed.length > 0 ? completed[completed.length - 1].actor : null

  if (streetName === 'Preflop') {
    const generics = GENERIC_POSITIONS.filter((p) => !spokenSet.has(p) && !cannotAct.has(p))
    let maxSpokenIdx = -1
    for (const a of completed) {
      const idx = order.indexOf(a.actor)
      if (idx > maxSpokenIdx) maxSpokenIdx = idx
    }
    const ordered =
      maxSpokenIdx === -1
        ? order.filter((p) => !spokenSet.has(p) && !cannotAct.has(p))
        : order.slice(maxSpokenIdx + 1).filter((p) => !cannotAct.has(p))
    return [...generics, ...ordered]
  }

  if (!lastActor) return sortPositions(preflopActors.filter((p) => !cannotAct.has(p)), order)
  const lastIdx = order.indexOf(lastActor)
  return sortPositions(
    preflopActors.filter((p) => {
      if (spokenSet.has(p)) return false
      if (cannotAct.has(p)) return false
      const pIdx = order.indexOf(p)
      if (lastIdx === -1 || pIdx === -1) return true
      return pIdx > lastIdx
    }),
    order,
  )
}

// ---------------------------------------------------------------------------
// Active / folded player tracking
// ---------------------------------------------------------------------------

/**
 * Given a completed street's actions and the pool entering it, return the
 * subset still active after it — removing explicit folders (verb 'f') and
 * implicit folders (bypassed in the re-open response order).
 */
function activeAfterStreet(
  actions: Action[],
  pool: Position[],
  order: Position[],
  alreadyAllIn: Set<Position> = new Set(),
): Position[] {
  const explicitFolders = new Set<Position>()
  for (const a of actions) if (a.verb === 'f') explicitFolders.add(a.actor)

  let lastReopenIdx = -1
  for (let i = actions.length - 1; i >= 0; i--) {
    const v = actions[i].verb
    if (v !== undefined && REOPENING_VERBS.has(v)) {
      lastReopenIdx = i
      break
    }
  }

  if (lastReopenIdx === -1) {
    return pool.filter((a) => !explicitFolders.has(a))
  }

  // Players who can't respond: all-in from prior streets + went all-in in this street before the last reopen
  const cannotAct = new Set<Position>([
    ...alreadyAllIn,
    ...allInActorsIn(actions.slice(0, lastReopenIdx)),
  ])

  const reopener = actions[lastReopenIdx].actor
  const reopenerIdx = order.indexOf(reopener)
  const beforeSet = new Set(uniqueActors(actions.slice(0, lastReopenIdx)))
  const spokenAfterSet = new Set(uniqueActors(actions.slice(lastReopenIdx + 1)))

  const firstTimers = pool.filter((p) => {
    if (p === reopener) return false
    if (cannotAct.has(p)) return false
    const pIdx = order.indexOf(p)
    if (reopenerIdx === -1 || pIdx === -1) return !beforeSet.has(p)
    return pIdx > reopenerIdx
  })
  const secondTimers = pool.filter((p) => p !== reopener && beforeSet.has(p) && !cannotAct.has(p))
  const responseOrder = [...sortPositions(firstTimers, order), ...sortPositions(secondTimers, order)]
  const implicitFolders = new Set(responseOrder.filter((p) => !spokenAfterSet.has(p)))

  return pool.filter((a) => !explicitFolders.has(a) && !implicitFolders.has(a))
}

/** Actors still active going into postflop, derived from preflop actions. */
function postflopActors(preflopActions: Action[]): Position[] {
  const completed = completeActions(preflopActions)
  return activeAfterStreet(completed, uniqueActors(completed), POSITION_ORDER)
}

/** The pool of actors active entering the given (last) street index. */
function activePoolEntering(state: HandState, throughStreetCount: number): Position[] {
  const preflop = state.streets.find((s) => s.name === 'Preflop')
  let pool = preflop ? postflopActors(preflop.actions) : []
  const allIn = new Set<Position>(preflop ? allInActorsIn(completeActions(preflop.actions)) : [])
  for (let i = 0; i < throughStreetCount; i++) {
    const s = state.streets[i]
    if (s && s.name !== 'Preflop') {
      const completed = completeActions(s.actions)
      pool = activeAfterStreet(completed, pool, POSTFLOP_POSITION_ORDER, allIn)
      for (const a of completed) if (a.verb === 'a') allIn.add(a.actor)
    }
  }
  return pool
}

/**
 * Across all played streets, the set of actors who folded (explicitly or
 * implicitly). Only tracked-pool actors can be marked folded.
 */
export function foldedActors(state: HandState): Set<Position> {
  const folded = new Set<Position>()

  const preflop = state.streets.find((s) => s.name === 'Preflop')
  let activePool: Position[] = []
  const allIn = new Set<Position>()
  if (preflop) {
    const completed = completeActions(preflop.actions)
    const appearedPre = uniqueActors(completed)
    activePool = postflopActors(preflop.actions)
    const activeSet = new Set(activePool)
    for (const a of appearedPre) if (!activeSet.has(a)) folded.add(a)
    for (const a of completed) if (a.verb === 'a') allIn.add(a.actor)
  }

  for (const street of state.streets) {
    if (street.name === 'Preflop') continue
    const completed = completeActions(street.actions)
    const next = activeAfterStreet(completed, activePool, POSTFLOP_POSITION_ORDER, allIn)
    const nextSet = new Set(next)
    for (const a of activePool) if (!nextSet.has(a)) folded.add(a)
    activePool = next
    for (const a of completed) if (a.verb === 'a') allIn.add(a.actor)
  }

  return folded
}

// ---------------------------------------------------------------------------
// Verb legality (facing-bet / BB option)
// ---------------------------------------------------------------------------

export interface VerbOptions {
  verbs: Verb[]
  facingBet: boolean
  bbOption: boolean
}

export function legalVerbs(
  streetName: StreetName,
  actor: Position,
  prior: Action[],
  heroPosition?: Position,
): VerbOptions {
  if (streetName === 'Preflop') {
    const resolved = actor === 'H' && heroPosition ? heroPosition : actor
    const hasRaise = hasBetOrRaise(prior)
    if (resolved === 'BB' && !hasRaise) {
      return { verbs: ['x', 'r', 'f', 'a'], facingBet: false, bbOption: true }
    }
    return { verbs: ['c', 'r', 'f', 'a'], facingBet: true, bbOption: false }
  }
  const facing = hasBetOrRaise(prior)
  return facing
    ? { verbs: ['c', 'r', 'f', 'a'], facingBet: true, bbOption: false }
    : { verbs: ['x', 'b', 'f', 'a'], facingBet: false, bbOption: false }
}

// ---------------------------------------------------------------------------
// Street advancement
// ---------------------------------------------------------------------------

function boardCount(state: HandState): number {
  return state.board?.length ?? 0
}

export function canAdvanceStreet(state: HandState): boolean {
  const last = state.streets[state.streets.length - 1]
  if (!last) return false
  const board = boardCount(state)
  switch (last.name) {
    case 'Preflop':
      return board >= 3
    case 'Flop':
      return board >= 4
    case 'Turn':
      return board >= 5
    case 'River':
      return false
  }
}

export function nextStreetName(state: HandState): StreetName | undefined {
  const last = state.streets[state.streets.length - 1]
  if (!last) return 'Preflop'
  const idx = STREET_ORDER.indexOf(last.name)
  return idx >= 0 && idx < STREET_ORDER.length - 1 ? STREET_ORDER[idx + 1] : undefined
}

// ---------------------------------------------------------------------------
// Showdown eligibility
// ---------------------------------------------------------------------------

function activePoolAtShowdown(state: HandState): Position[] {
  const preflop = state.streets.find((s) => s.name === 'Preflop')
  let pool = preflop ? postflopActors(preflop.actions) : []
  const allIn = new Set<Position>(preflop ? allInActorsIn(completeActions(preflop.actions)) : [])
  for (const s of state.streets) {
    if (s.name !== 'Preflop') {
      const completed = completeActions(s.actions)
      pool = activeAfterStreet(completed, pool, POSTFLOP_POSITION_ORDER, allIn)
      for (const a of completed) if (a.verb === 'a') allIn.add(a.actor)
    }
  }
  return pool
}

/** Players still in the hand who may take a showdown action (excluding already-shown). */
export function showdownEligibleActors(state: HandState, excludeActors: Set<Position> = new Set()): Position[] {
  const folded = foldedActors(state)
  const pool = activePoolAtShowdown(state)
  const allowed = new Set<Position>([...pool, 'H', 'V'])
  return ALL_POSITIONS.filter(
    (p) => allowed.has(p) && !folded.has(p) && !excludeActors.has(p),
  )
}

// ---------------------------------------------------------------------------
// nextStep — the suggestion driver (pure function of state)
// ---------------------------------------------------------------------------

function showdownNextStep(state: HandState): NextStep {
  const entries = state.showdown ?? []
  const trailing = entries[entries.length - 1]
  if (trailing) {
    if (trailing.verb === undefined) return { kind: 'showdownVerb', actor: trailing.actor }
    if (trailing.verb === 'shows' && trailing.cards === undefined) {
      return { kind: 'showdownCards', actor: trailing.actor }
    }
  }
  const shown = new Set(entries.map((e) => e.actor))
  const options = showdownEligibleActors(state, shown)
  return { kind: 'showdownActor', options, canSave: entries.length > 0 }
}

function streetNextStep(
  state: HandState,
  street: Street,
  preflopActors: Position[],
  alreadyAllIn: Set<Position> = new Set(),
): NextStep {
  const actions = street.actions
  const trailing = actions[actions.length - 1]
  const heroPos = state.hero?.position

  if (trailing && trailing.verb === undefined) {
    const prior = actions.slice(0, -1)
    const { verbs, facingBet, bbOption } = legalVerbs(street.name, trailing.actor, prior, heroPos)
    return { kind: 'verb', street: street.name, actor: trailing.actor, options: verbs, facingBet, bbOption }
  }

  const options = legalActorsToAct(street.name, actions, preflopActors, alreadyAllIn)
  const hasAny = actions.length > 0
  return {
    kind: 'actor',
    street: street.name,
    options,
    canAdvance: hasAny && canAdvanceStreet(state),
    canShowdown: hasAny,
    canSave: hasAny,
  }
}

export function nextStep(state: HandState): NextStep {
  if (state.board === undefined) return { kind: 'board' }
  if (state.hero === undefined) return { kind: 'heroPosition', options: HERO_POSITIONS }
  if (state.hero.cards === undefined) return { kind: 'heroCards' }

  if (state.showdown !== undefined) return showdownNextStep(state)

  if (state.streets.length === 0) {
    return {
      kind: 'actor',
      street: 'Preflop',
      options: legalActorsToAct('Preflop', [], []),
      canAdvance: false,
      canShowdown: false,
      canSave: false,
    }
  }

  const last = state.streets[state.streets.length - 1]
  const streetIdx = state.streets.length - 1
  const pool = activePoolEntering(state, streetIdx)
  const allIn = allInBeforeStreet(state, streetIdx)
  return streetNextStep(state, last, pool, allIn)
}

/** True when the hand is complete enough to serialize / save. */
export function isComplete(state: HandState): boolean {
  if (state.board === undefined) return false
  if (state.hero === undefined || state.hero.cards === undefined) return false
  if (state.streets.length === 0) return false
  for (const s of state.streets) {
    if (s.actions.length === 0) return false
    for (const a of s.actions) if (a.verb === undefined) return false
  }
  if (state.showdown !== undefined) {
    for (const e of state.showdown) {
      if (e.verb === undefined) return false
      if (e.verb === 'shows' && e.cards === undefined) return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// Pot calculation
// ---------------------------------------------------------------------------

function parseStakesAmounts(stakes: string | undefined): { sb: number; bb: number } {
  if (!stakes) return { sb: 0, bb: 0 }
  const match = /\$?(\d+(?:\.\d+)?)\s*\/\s*\$?(\d+(?:\.\d+)?)/.exec(stakes)
  if (!match) return { sb: 0, bb: 0 }
  return { sb: Number(match[1]), bb: Number(match[2]) }
}

function computeStreetContributions(
  streetName: StreetName,
  actions: Action[],
  sbAmount: number,
  bbAmount: number,
): number {
  const contributions = new Map<Position, number>()
  let currentBet = 0

  if (streetName === 'Preflop') {
    contributions.set('SB', sbAmount)
    contributions.set('BB', bbAmount)
    currentBet = bbAmount
  }

  for (const action of actions) {
    if (action.verb === undefined) continue
    switch (action.verb) {
      case 'f':
      case 'x':
        break
      case 'c':
        contributions.set(action.actor, currentBet)
        break
      case 'r':
      case 'b':
        if (action.amount !== undefined) {
          contributions.set(action.actor, action.amount)
          currentBet = action.amount
        }
        break
      case 'a':
        if (action.amount !== undefined) {
          contributions.set(action.actor, action.amount)
          if (action.amount > currentBet) currentBet = action.amount
        }
        break
    }
  }

  let total = 0
  for (const v of contributions.values()) total += v
  return total
}

/**
 * Returns the pot size at the start of the street at the given index (0 = Preflop).
 * Pass `state.streets.length` to get the pot after all streets (e.g. at showdown).
 */
export function computePotAtStreetStart(state: HandState, streetIndex: number): number {
  const { sb, bb } = parseStakesAmounts(state.stakes)
  let pot = 0
  for (let i = 0; i < streetIndex && i < state.streets.length; i++) {
    pot += computeStreetContributions(state.streets[i].name, state.streets[i].actions, sb, bb)
  }
  return pot
}

// ---------------------------------------------------------------------------
// Used cards (for card pickers)
// ---------------------------------------------------------------------------

function cardCode(c: Card): string {
  return c.rank + c.suit
}

export function usedCards(state: HandState): Set<string> {
  const used = new Set<string>()
  for (const c of state.board ?? []) used.add(cardCode(c))
  if (state.hero?.cards) for (const c of state.hero.cards) used.add(cardCode(c))
  for (const e of state.showdown ?? []) if (e.cards) for (const c of e.cards) used.add(cardCode(c))
  return used
}

// ---------------------------------------------------------------------------
// Edit-option helpers (legal options for an EXISTING node — the bug fix)
// ---------------------------------------------------------------------------

export function legalActorsForActionSlot(state: HandState, streetName: StreetName, index: number): Position[] {
  const streetIdx = state.streets.findIndex((s) => s.name === streetName)
  if (streetIdx === -1) return ALL_POSITIONS
  const street = state.streets[streetIdx]
  const prior = completeActions(street.actions.slice(0, index))
  const pool = activePoolEntering(state, streetIdx)
  const alreadyAllIn = allInBeforeStreet(state, streetIdx)
  return legalActorsToAct(streetName, prior, pool, alreadyAllIn)
}

export function legalVerbsForActionSlot(state: HandState, streetName: StreetName, index: number): VerbOptions {
  const street = state.streets.find((s) => s.name === streetName)
  if (!street) return { verbs: ['x', 'c', 'r', 'f', 'b', 'a'], facingBet: false, bbOption: false }
  const action = street.actions[index]
  const prior = street.actions.slice(0, index)
  return legalVerbs(streetName, action.actor, prior, state.hero?.position)
}

export function legalShowdownActorsForSlot(state: HandState, index: number): Position[] {
  const entries = state.showdown ?? []
  const others = new Set<Position>(entries.filter((_, i) => i !== index).map((e) => e.actor))
  return showdownEligibleActors(state, others)
}

// ---------------------------------------------------------------------------
// Immutable update helpers
// ---------------------------------------------------------------------------

function blankState(): HandState {
  return { id: mkId(), streets: [], notes: [] }
}

function replaceStreet(state: HandState, name: StreetName, fn: (s: Street) => Street): HandState {
  return { ...state, streets: state.streets.map((s) => (s.name === name ? fn(s) : s)) }
}

function updateActions(street: Street, fn: (a: Action[]) => Action[]): Street {
  return { ...street, actions: fn(street.actions) }
}

// ---------------------------------------------------------------------------
// Mutations — recording
// ---------------------------------------------------------------------------

export function createBlank(): HandState {
  return blankState()
}

export function setStakes(state: HandState, stakes: string | undefined): HandState {
  return { ...state, stakes }
}

export function setBoard(state: HandState, cards: Card[]): HandState {
  return { ...state, board: cards }
}

export function setHeroPosition(state: HandState, position: Position): HandState {
  const cards = state.hero?.cards
  return { ...state, hero: cards ? { position, cards } : { position } }
}

export function setHeroCards(state: HandState, cards: [Card, Card]): HandState {
  const position = state.hero?.position ?? 'H'
  return { ...state, hero: { position, cards } }
}

/** Ensure a Preflop street exists, returning the possibly-updated state. */
function ensurePreflop(state: HandState): HandState {
  if (state.streets.some((s) => s.name === 'Preflop')) return state
  return { ...state, streets: [...state.streets, { name: 'Preflop', actions: [] }] }
}

export function advanceToStreet(state: HandState, name: StreetName): HandState {
  return { ...state, streets: [...state.streets, { name, actions: [] }] }
}

/** Append a verbless action (actor chosen, awaiting verb) to the named street. */
export function beginAction(state: HandState, streetName: StreetName, actor: Position): HandState {
  const seeded = ensurePreflop(state)
  return replaceStreet(seeded, streetName, (s) =>
    updateActions(s, (acts) => [...acts, { id: mkId(), actor }]),
  )
}

/** Set the verb (and optional amount) on the action at (street, index). */
export function setVerb(
  state: HandState,
  streetName: StreetName,
  index: number,
  verb: Verb,
  amount?: number,
): HandState {
  return replaceStreet(state, streetName, (s) =>
    updateActions(s, (acts) =>
      acts.map((a, i) => {
        if (i !== index) return a
        const next: Action = { id: a.id, actor: a.actor, verb }
        if (amount !== undefined) next.amount = amount
        return next
      }),
    ),
  )
}

// ---------------------------------------------------------------------------
// Mutations — showdown
// ---------------------------------------------------------------------------

export function beginShowdown(state: HandState): HandState {
  return { ...state, showdown: state.showdown ?? [] }
}

export function beginShowdownActor(state: HandState, actor: Position): HandState {
  const entries = state.showdown ?? []
  return { ...state, showdown: [...entries, { id: mkId(), actor }] }
}

export function setShowdownVerb(state: HandState, index: number, verb: ShowdownVerb): HandState {
  const entries = state.showdown ?? []
  return {
    ...state,
    showdown: entries.map((e, i) => (i === index ? { id: e.id, actor: e.actor, verb } : e)),
  }
}

export function setShowdownCards(state: HandState, index: number, cards: [Card, Card]): HandState {
  const entries = state.showdown ?? []
  return {
    ...state,
    showdown: entries.map((e, i) => (i === index ? { ...e, verb: 'shows', cards } : e)),
  }
}

// ---------------------------------------------------------------------------
// Mutations — notes
// ---------------------------------------------------------------------------

/** Anchor a new note to the most recently-recorded section. */
function currentNoteAnchor(state: HandState): NoteAnchor {
  if (state.showdown !== undefined) return 'showdown'
  const withActions = [...state.streets].reverse().find((s) => s.actions.length > 0)
  if (withActions) return withActions.name
  if (state.hero?.cards) return 'hero'
  if (state.board !== undefined) return 'board'
  if (state.stakes !== undefined) return 'stakes'
  return 'top'
}

export function addNote(state: HandState, text: string): HandState {
  const trimmed = text.trim()
  if (!trimmed) return state
  return { ...state, notes: [...state.notes, { id: mkId(), text: trimmed, anchor: currentNoteAnchor(state) }] }
}

export function editNote(state: HandState, noteId: string, text: string): HandState {
  return { ...state, notes: state.notes.map((n) => (n.id === noteId ? { ...n, text: text.trim() } : n)) }
}

// ---------------------------------------------------------------------------
// Edits — board / hero / stakes
// ---------------------------------------------------------------------------

export function editBoardCard(state: HandState, index: number, card: Card): HandState {
  const board = (state.board ?? []).map((c, i) => (i === index ? card : c))
  return { ...state, board }
}

export function addBoardCard(state: HandState, card: Card): HandState {
  return { ...state, board: [...(state.board ?? []), card] }
}

export function editHeroPosition(state: HandState, position: Position): HandState {
  return setHeroPosition(state, position)
}

export function editHeroCard(state: HandState, index: number, card: Card): HandState {
  if (!state.hero?.cards) return state
  const cards = state.hero.cards.map((c, i) => (i === index ? card : c)) as [Card, Card]
  return { ...state, hero: { ...state.hero, cards } }
}

// ---------------------------------------------------------------------------
// Edits — actions / showdown entries
// ---------------------------------------------------------------------------

export function editActor(state: HandState, streetName: StreetName, index: number, actor: Position): HandState {
  return replaceStreet(state, streetName, (s) =>
    updateActions(s, (acts) => acts.map((a, i) => (i === index ? { ...a, actor } : a))),
  )
}

export function editShowdownActor(state: HandState, index: number, actor: Position): HandState {
  const entries = state.showdown ?? []
  return { ...state, showdown: entries.map((e, i) => (i === index ? { ...e, actor } : e)) }
}

export function editShowdownVerb(state: HandState, index: number, verb: ShowdownVerb): HandState {
  const entries = state.showdown ?? []
  return {
    ...state,
    showdown: entries.map((e, i) => {
      if (i !== index) return e
      // switching away from "shows" drops cards
      return verb === 'shows' ? { ...e, verb } : { id: e.id, actor: e.actor, verb }
    }),
  }
}

export function editShowdownCard(state: HandState, index: number, cardIndex: number, card: Card): HandState {
  const entries = state.showdown ?? []
  return {
    ...state,
    showdown: entries.map((e, i) => {
      if (i !== index || !e.cards) return e
      const cards = e.cards.map((c, j) => (j === cardIndex ? card : c)) as [Card, Card]
      return { ...e, cards }
    }),
  }
}
