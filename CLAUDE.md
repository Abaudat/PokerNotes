# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test             # run all tests once (vitest run)
npm run test:watch   # run tests in watch mode
npm run build        # tsc type-check + vite build
npm run lint         # eslint
npm run format       # prettier --write
npm run dev          # local dev server (http://localhost:5173/PokerNotes/)
```

Run a single test file:
```bash
npx vitest run src/core/chips.test.ts
```

Run tests matching a name pattern:
```bash
npx vitest run -t "breakdown"
```

## Architecture

**A rules-aware AST (`HandState`) is the source of truth in the editor.** Plain text is used only at the Firebase persistence boundary (`serializeHand` to save, `parseHand` to load). The editor holds a `HandState`; recording and editing both go through the engine, which owns every poker rule and is the single source of suggestions — so the wizard and the edit-option lists can never diverge.

### Core (pure, no framework imports)

`src/core/` contains all domain logic — fully unit-testable without React or Firebase:

- **`types.ts`** — all shared types: `Card`, `HandState`, `Action`, `Street`, `ShowdownEntry`, `Note`, `Position`, `Verb`, `NextStep`, etc. The model is span-free; nodes that the editor addresses carry a stable `id`. The model may be **partial during recording** (board/hero unset, a trailing action without a verb).
- **`cards.ts`** — `parseCard(s)` / `formatCard(c)`, `SUIT_GLYPHS` (`♠♥♦♣`), `RANKS`, `SUITS`
- **`parser.ts`** — `parseHand(raw) → HandState`. Parses the persisted text grammar into the semantic model and captures `#` notes; assigns fresh node IDs (`node_N`, reset per call).
- **`serializer.ts`** — `serializeHand(state) → string`. Re-emits notes at their anchors. Throws on an incomplete state. Round-trip invariant: `parse(serialize(state)) ≡ state` **structurally, ignoring ids**.
- **`engine.ts`** — the poker rules engine (the heart). `nextStep(state)` drives the wizard; `legalActorsToAct` / `legalVerbs` / `activeAfterStreet` / `foldedActors` / `showdownEligibleActors` encode the rules; `legal*ForActionSlot` / `legalShowdownActorsForSlot` give the legal options for an **existing** node (used by the edit overlays); plus immutable mutation/edit ops (`beginAction`, `setVerb`, `advanceToStreet`, `editActor`, …) that are the editor's only way to change the model.
- **`render.ts`** — `buildHandViewModel(state)` (read-only view) and `buildEditorView(state) → ChipLine[]` (interactive editor chips, keyed by positional ids like `action:Preflop:0:verb`), plus `POSITION_COLORS` / `HERO_COLOR`.
- **`export.ts`** — `formatForExport(state) → string`, suit glyphs, full action words.

### Data layer

`src/data/` — `HandRepository` interface (`save / list / subscribe / get / update / delete`):
- `InMemoryRepository` — for tests/dev
- `FirestoreRepository` — production (M5)

### UI

`src/ui/` — React components (M4+). `src/app/App.tsx` is the entry point.

### Key invariants

- The engine is the **single source of poker rules**. The wizard (`nextStep`) and the edit-option lists (`legal*ForActionSlot`) both derive from it, so they cannot drift apart. Editing a node only ever offers the legal options for that slot.
- The editor mutates `HandState` exclusively through engine ops; the persisted text is produced by `serializeHand` only at save time. Existing stored hands stay loadable (`parseHand` accepts the legacy text format, including `all in`/`a` and packed cards).
- `serializeHand(parseHand(raw))` normalizes raw (canonical form); `parseHand(serializeHand(state))` reproduces the same model structure (ids aside). Notes must never be lost across a round-trip.
- `src/core/` must never import from React, Firebase, or `src/ui/`.

## Workflow rules

- **Before starting any implementation:** pull from `origin/main` first — GitHub is the source of truth and prior milestones may already be merged.
  ```bash
  git pull origin main
  ```
- **Before pushing:** always run `npm test && npm run build && npm run test:e2e:full` and fix any failures before pushing. `test:e2e:full` starts the Firebase emulator automatically — no separate setup needed.
- A task is only "done" when the code is submitted as a PR to GitHub (`gh pr create`).

## Build plan context

Milestones: M0 scaffold ✓ → M1 core text model ✓ → M2 suggestion engine → M3 presentation logic → M4 UI components → M5 persistence/auth → M6 E2E → M7 deploy.
