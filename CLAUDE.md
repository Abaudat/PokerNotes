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

**The plain text is the source of truth.** The app stores a hand as a raw string; everything else is derived from it.

### Core (pure, no framework imports)

`src/core/` contains all domain logic — fully unit-testable without React or Firebase:

- **`types.ts`** — all shared types: `Card`, `Token<T>` (value + stable `id` + `Span`), `HandAST`, `Action`, `Street`, `Position`, `Verb`, etc.
- **`cards.ts`** — `parseCard(s)` / `formatCard(c)`, `SUIT_GLYPHS` (`♠♥♦♣`), `RANKS`, `SUITS`
- **`parser.ts`** — `parseHand(raw) → HandAST`. Counter-based deterministic token IDs (`tok_N`), reset on each call. Every token carries `{ id, value, span }` so the UI can map rendered elements back to their source position.
- **`serializer.ts`** — `serializeHand(ast) → string`. Round-trip invariant: `parse(serialize(ast)) ≡ ast`.
- **`suggestions.ts`** *(M2, not yet implemented)* — `nextSuggestions(ast, cursor) → { mode, options[] }`
- **`chips.ts`** *(M3)* — `breakdown(amount, denoms?) → Chip[]`, greedy over `[1000, 500, 100, 25, 5, 1]`
- **`render.ts`** *(M3)* — view-model builder: cards → display tokens, positions → colors, Hero accent
- **`export.ts`** *(M3)* — `formatForExport(ast) → string`, suit glyphs, full action words
- **`editing.ts`** *(M3)* — `replaceToken(ast, id, newValue) → HandAST`

### Data layer

`src/data/` — `HandRepository` interface (`save / list / subscribe / get / update / delete`):
- `InMemoryRepository` — for tests/dev
- `FirestoreRepository` — production (M5)

### UI

`src/ui/` — React components (M4+). `src/app/App.tsx` is the entry point.

### Key invariants

- Token IDs are stable within a parsed hand; the editing model uses them to map UI interactions back to the AST (`replaceToken(ast, id, value)`).
- `serializeHand(parseHand(raw))` normalizes raw (canonical form); `parseHand(serializeHand(ast))` must reproduce the same AST structure.
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
