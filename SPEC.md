# PokerNotes — Specification

> The canonical guide for building PokerNotes. The app is built **test-first (TDD)**,
> pure-logic-first, against the milestones in [Build plan](#build-plan-tdd).

## 1. Purpose

When playing poker, recording interesting hands as free text is too slow — a hand often
can't be finished before the next one deals, and the details are forgotten. **PokerNotes**
is a phone + desktop web app for *blazingly fast* hand recording with a clean,
copy-pasteable output for forums and bankroll apps, plus a private, auto-syncing history
browser.

**Headline goal: recording a hand takes ≤10 seconds.**

The whole stack is **free**: GitHub Pages (static frontend) + Firebase Spark tier (auth +
database + realtime sync, no credit card). A reliable network is assumed — no offline-first
design is required (Firestore's offline cache is a free bonus, not a design driver).

## 2. Requirements

| # | Requirement | How it is met |
|---|---|---|
| 1 | ≤10s to record a hand | Suggestion state-machine drives one-tap pickers (cards/positions/actions/chips). |
| 2 | Phone + computer web app on GitHub Pages | React + Vite SPA, static build, `base: /PokerNotes/`, deployed to `abaudat.github.io/PokerNotes`. |
| 3 | Auto cross-device sync, no user action | Firestore real-time listeners; writes propagate automatically. |
| 4 | Multi-user, per-user-private history | Firebase Auth (Google); data under `users/{uid}/…`; security rules enforce `uid == auth.uid`. |
| 5 | Entire stack free | GitHub Pages + Firebase Spark (free, no card). |
| 6 | Copy-paste, nicely formatted, human-readable | Pure `formatForExport()` producing suit-glyph text (♠♥♦♣). |
| 7 | History browser (date + info; click → readable hand) | Firestore query ordered by `createdAt desc`; detail view renders the full hand. |
| 8 | Strong UX (card images, colored chips, position/Hero colors) | SVG card components, greedy chip-stack render with casino colors, distinct position palette, Hero accent. |

## 3. Tech stack

- **Frontend:** React + TypeScript + Vite (SPA, static output).
- **Testing:** Vitest + React Testing Library (unit/component); `@firebase/rules-unit-testing`
  + Firebase emulator (rules/repo); Playwright (E2E, headless-capable).
- **Backend (BaaS):** Firebase — Firestore (data + realtime), Firebase Auth (Google).
- **Hosting:** GitHub Pages via GitHub Actions.
- **Cards:** an open-licensed SVG deck behind a `<Card code="As" />` abstraction (recommended:
  `@letele/playing-cards`, MIT; swappable). A card-back asset is used for unknown board slots.

## 4. Architecture

```
[React SPA on GitHub Pages]
   ├─ Pure core (no framework imports, 100% unit-tested)
   │    parser  ↔  Hand AST  ↔  serializer
   │    suggestion engine (state machine)
   │    chip breakdown · render view-model · export formatter
   ├─ UI components (Card, CardPicker, PositionPicker, ActionButtons,
   │    ChipPicker, ChipStack, HandView, Recorder, HistoryBrowser)
   └─ HandRepository (interface)
         ├─ InMemoryRepository (tests/dev)
         └─ FirestoreRepository → Firebase (Auth + Firestore)
```

**The plain text is the source of truth.** Everything renders *from* it; every edit writes
*back to* it. The pure core has no React/Firebase imports, making it trivially TDD-able.

## 5. Domain model & canonical text format

A hand is recorded in a fixed order (board first, by convention):

```
[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f
```

Grammar (informal EBNF):

```
hand     = [stakes] board hero street+
stakes   = "Stakes:" text
board    = "Board:" card{0|3|4|5}
hero     = "Hero:" actor card card
street   = ("Preflop"|"Flop"|"Turn"|"River") ":" action ("," action)*
action   = actor verb [amount]
actor    = "UTG" | "UTG+1" | "UTG+2" | "UTG+3" | "HJ" | "CO"
           | "BTN" | "SB" | "BB" | "EP" | "MP"
verb     = "x"(check) | "c"(call) | "r"(raise) | "f"(fold) | "b"(bet)
amount   = number          ; required iff verb ∈ {r, b}
card     = rank suit ; rank ∈ 2..9,T,J,Q,K,A ; suit ∈ s,h,d,c
```

- Actors are always real positions. The hero/villain roles are **derived for display**, never
  stored: the hero's seat is marked `H (pos)`, and when the hand is heads-up by the flop the lone
  opponent's seat is marked `V (pos)` (retroactively across all streets).
- The streets present are bounded by board length (3 cards ⇒ up to Flop, 4 ⇒ Turn, 5 ⇒ River;
  0 ⇒ folded preflop).
- The parser yields a **Hand AST** in which every token has a stable `id` + source span, so
  the UI can map a rendered element back to its text and edit it in place.
- **Round-trip invariant:** `parse(serialize(ast)) ≡ ast`, and `serialize(parse(raw))`
  normalizes `raw` — a core property test.

## 6. Suggestion engine (the speed core)

Pure function: `nextSuggestions(raw) → { mode, options[], context? }`.

Takes the current raw string (which may be partial/incomplete) and returns what to prompt for next.

| Mode | When | `options` | `context` fields |
|---|---|---|---|
| `AWAIT_BOARD` | No Board: line | `['NO_BOARD', ...all52]` | — |
| `AWAIT_HERO_POS` | Board done | all positions | — |
| `AWAIT_HERO_CARDS` | Hero pos set | all 52 minus used cards | — |
| `AWAIT_ACTOR` | Need next actor | all positions | `street`, `canAdvance`, `canSave` |
| `AWAIT_VERB` | Actor set | `['x','b','f']` or `['c','r','f']` | `street`, `facingBet` |
| `AWAIT_AMOUNT` | Verb ∈ {r,b} | `[]` (free numeric) | `street` |

`context.canAdvance` is true when there are enough board cards to move to the next street.
`context.canSave` is true when the last action is complete (the hand could end here).

Canonical example: state after `… H r 40, CO` (actor `CO`, facing a raise) ⇒ `AWAIT_VERB`
with options `['c','r','f']` and `context.facingBet = true`. All heuristics (facing-bet
detection, street-advance availability) are pure and unit-tested; free-text entry is always
available as an escape hatch.

## 7. Presentation (pure → view-model)

- **Cards:** `code → <Card>` (SVG); unknown board slots render the card **back**.
- **Chips:** `breakdown(amount, denoms) → Chip[]`, greedy over the casino set
  `[1000, 500, 100, 25, 5, 1]` (extensible; cents optional). Colors: **$1 white, $5 red,
  $25 green, $100 black, $500 purple, $1000 yellow**. `<ChipStack>` renders the stack with
  the amount label alongside.
- **Positions / Hero:** a distinct color per position (tunable palette); **Hero** always
  gets a strong accent + "HERO" tag so Hero vs Villain is instantly readable.
- **Chip input:** tap denomination chips to accumulate, or type a number directly.

## 8. Copy-paste export

`formatForExport(ast) → string` — human-readable, suit glyphs, full action words:

```
2026-06-06 · $2/$5 NLH
Board: A♠ 8♥ T♦
Hero (BTN): A♥ K♠
Preflop: Hero raises $15, BB calls
Flop: BB checks, Hero bets $20, BB calls
Turn: BB checks, Hero checks
River: BB bets $40, Hero folds
```

Pure and fully unit-tested. *Stretch:* optional pot totals per street, computable from the AST.

## 9. Editing model

Click any rendered token (card, position, action, amount) → reopens the matching picker for
that token's `id` → `replaceToken(ast, id, value)` rebuilds the raw text → re-render. The
pure token-replacement is unit-tested independently of the UI.

## 10. Data model, auth & sync (Firebase)

Firestore:

```
users/{uid}/hands/{handId} = {
  raw: string,            // source of truth
  summary: {              // denormalized for fast list rendering
    board: string[], heroCards: string, heroPosition: string,
    streetReached: string, stakes?: string
  },
  createdAt, updatedAt
}
```

- **Repository interface** (`save / list / subscribe / get / update / delete`);
  `InMemoryRepository` for tests/dev, `FirestoreRepository` for prod.
- **Realtime sync:** `onSnapshot` subscription gives automatic cross-device sync.
- **Auth:** Google sign-in; `uid` scopes all data.
- **Security rules:** allow read/write `users/{uid}/**` only when `request.auth.uid == uid`;
  validated with `@firebase/rules-unit-testing` against the emulator.
- The Firebase web config is embedded in the client (public by design; rules enforce privacy).

## 11. ≤10s recording flow (UX)

**The editor is a guided wizard, not a text box.** Each step calls `nextSuggestions(raw)` and renders one input. The raw string is built silently as the user taps.

### Step-by-step flow

1. **Stakes** (optional pre-step): quick-tap presets (`$1/$2`, `$2/$5`, `$5/$10`, `$10/$20`) or Skip. Prepends `Stakes: X/Y\n`.

2. **Board cards** (`AWAIT_BOARD`): card picker grid. "No board" (if 0 selected) or "Done" (enabled at 3–5 cards). Selection count badge shown.

3. **Hero position** (`AWAIT_HERO_POS`): button row of positions.

4. **Hero hole cards** (`AWAIT_HERO_CARDS`): card picker grid; board cards are disabled. "Done" enabled at exactly 2 selected; button label shows the chosen cards.

5. **Street actions loop:**
   - `AWAIT_ACTOR`: position buttons. Also **→ Next street** if `canAdvance`, **Save hand** if `canSave`.
   - `AWAIT_VERB`: `[Check] [Bet] [Fold]` or `[Call] [Raise] [Fold]` based on `facingBet`.
   - `AWAIT_AMOUNT`: numeric input with OK / Enter.

6. **Save**: `parseHand(raw)` → `onSave(raw, ast)`.

### Card picker grid layout

4 columns (suits ♠ ♥ ♦ ♣), 13 rows (A → 2). Each cell: `{rank}{suit glyph}` button.
- Disabled (used): opacity 0.2, not clickable.
- Selected (pending): accent background, black text.
- Default: surface background, suit-colored glyph.

### Persistent UI elements

- **Undo**: reverts the raw string to its previous state (history stack).
- **Raw summary**: small `<pre>` showing the accumulating raw string.
- **"··· type manually"** escape hatch: text input appending arbitrary raw text. Used for Mississippi straddle, villain behavior annotations, etc.

### Edit mode

When `initialRaw` is provided, skip the wizard and show a plain `<textarea>`. Editing a recorded hand is rare; in-place token editing is a future milestone.

## 12. Project structure

```
src/
  core/        cards.ts, parser.ts, serializer.ts, suggestions.ts,
               chips.ts, render.ts, export.ts, types.ts   (+ *.test.ts)
  data/        repository.ts (iface), inMemoryRepository.ts,
               firestoreRepository.ts, firebase.ts
  ui/          Card, CardPicker, PositionPicker, ActionButtons,
               ChipPicker, ChipStack, HandView, Recorder, HistoryBrowser
  app/         App.tsx, auth, routing
firestore.rules
.github/workflows/deploy.yml
SPEC.md
```

## 13. Build plan (TDD)

Each milestone is **test-first**.

- **M0 — Scaffold (infra):** Vite + React + TS, Vitest, RTL, ESLint/Prettier, repo layout,
  CI test job. No app logic yet.
- **M1 — Core text model:** tests first for `parseCard`/`formatCard`, `parser` (raw→AST with
  token ids/spans), `serializer`, malformed-input handling, and the round-trip invariant.
- **M2 — Suggestion engine:** tests first covering every mode incl. the `H r 40, CO →
  [Call, Raise, Fold]` case, opening states, facing-bet detection, street advancement.
- **M3 — Presentation logic:** tests first for `chips.breakdown`, the `render` view-model,
  `formatForExport`, and `replaceToken` (editing).
- **M4 — UI components:** RTL behavior tests for each picker + `HandView` (cards/chips/
  colors), the `Recorder` flow (suggestions → pickers → raw updates), edit-a-token, and
  `HistoryBrowser`. Wired against `InMemoryRepository`.
- **M5 — Persistence & auth:** repository contract tests against both `InMemory` and the
  Firebase emulator; Google auth; realtime subscription; `firestore.rules` unit tests
  (owner-only access).
- **M6 — E2E & polish:** Playwright — record a hand within the tap budget, copy export,
  browse history, edit a card; responsive (phone + desktop), a11y, perf pass for the 10s goal.
- **M7 — Deploy:** GitHub Actions (test → build → Pages), Vite `base`, Firebase config via
  build env, add `abaudat.github.io` to Auth authorized domains.

## 14. Deployment

- `.github/workflows/deploy.yml`: install → `vitest run` → `vite build` → deploy `dist/` to
  GitHub Pages (official Pages action). Tests gate the deploy.
- Vite `base: '/PokerNotes/'`; SPA fallback (`404.html`) for client routing on Pages.
- Firebase: create a free project, enable Google auth, add the Pages domain to authorized
  domains, publish `firestore.rules`.

**Free-tier notes:** GitHub Pages is free static hosting. Firebase Spark is free with no
credit card; Firestore limits (≈50k reads / 20k writes per day, 1 GiB) vastly exceed
personal / small-group usage.

## 15. Verification

- `npx vitest run` — all unit/component tests green (core logic is the bulk).
- `firebase emulators:exec "vitest run src/data"` — repository + rules tests green.
- `npm run dev` — manually record a hand end-to-end; confirm the export copy is well-formed.
- `npx playwright test` — E2E flows incl. the tap-budget hand-recording test.
- Live: open on phone + desktop signed into the same Google account; record on phone, confirm
  it appears on desktop automatically; confirm another account cannot see the hand.
