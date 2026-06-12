# E2E Test List (M6)

Tests to implement with Playwright. Each test covers exactly one observable behaviour.
Setup code (seeding a hand, clearing Firestore) lives in `beforeEach` via helpers, not inside tests.

---

## `auth.spec.ts` — unauthenticated context (no storageState)

1. Unauthenticated user sees "PokerNotes" heading
2. Unauthenticated user sees "Sign in with Google" button
3. Unauthenticated user does not see the hand history header
4. Authenticated user sees their email in the header
5. Authenticated user sees hand count in the header
6. Clicking sign-out navigates to the sign-in page

---

## `record-hand.spec.ts` — authenticated

7. Stakes picker shows preset options ($1/$2, $2/$5, $5/$10, $10/$20) and a Skip button
8. Clicking a stakes preset advances the wizard to the next step
9. Clicking Skip advances the wizard without setting stakes
10. Board card picker shows a grid of cards
11. Selecting 3 board cards enables the board "Done" button
12. Board cards already selected as board cards are disabled in the hole card picker
13. Clicking a hero position selects it and advances the wizard
14. Selecting 2 hole cards enables the Save button (minimal hand)
15. Save button is disabled before hole cards are entered
16. Undo button reverts the most recent wizard step
17. Free-text toggle ("···") replaces the wizard with a textarea
18. Saving a hand navigates to the hand detail view

---

## `hand-history.spec.ts` — authenticated

19. Shows an empty-state message when no hands have been recorded
20. "+ New hand" button opens the hand wizard
21. Hand card shows the hero cards with suit glyphs
22. Hand card shows stakes when set
23. Hand card shows the hero position
24. Clicking a hand card navigates to the hand detail view
25. Hands are listed newest-first after recording two hands
26. Delete button removes the hand from the list
27. Delete button does not navigate away from the history view
49. Hands recorded today are grouped under a "Today" date header

---

## `hand-view.spec.ts` — authenticated, one seeded hand

28. View shows hero hole cards with suit glyphs
29. View shows board cards with suit glyphs
30. View shows stakes in the metadata line
31. View shows the hero position
32. View shows a preflop action's actor name
33. View shows a preflop action's verb
34. View shows a preflop action's amount when present
35. Back button returns to the history list
36. Edit button makes the edit textarea visible

---

## `edit-hand.spec.ts` — authenticated, one seeded hand

37. Edit textarea is pre-filled with the hand's current raw text
38. Valid edited text shows a success indicator
39. Syntactically invalid text shows a parse error message
40. Save button is disabled when the text is invalid
41. Saving updated text returns to the history list
42. The updated hand appears with new content in the history list
43. Cancel returns to history without saving
44. The hand is unchanged in history after cancel

---

## `export.spec.ts` — authenticated, one seeded hand

45. Clicking Export shows "✓ Copied!" feedback
46. "✓ Copied!" feedback disappears after ~2 seconds
47. Exported clipboard text contains at least one suit glyph (♠/♥/♦/♣)
48. Exported clipboard text contains the hand's stakes
