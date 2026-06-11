/**
 * E2E tests: editing chips in the live recording display.
 *
 * Each test records a hand up to a specific state, taps a chip to edit it,
 * applies the change, and verifies the result.
 */
import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

// ── Shared setup helpers ──────────────────────────────────────────────────────

async function startNewHand(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ New hand' }).click()
}

/** Records board + hero position + hole cards, ending at AWAIT_ACTOR (Preflop) */
async function recordUpToPreflop(
  page: import('@playwright/test').Page,
  opts: { boardCards?: string[]; heroPos?: string; holeCards?: string[] } = {},
) {
  const boardCards = opts.boardCards ?? ['A♠', 'K♠', 'Q♠']
  const heroPos = opts.heroPos ?? 'BTN'
  const holeCards = opts.holeCards ?? ['A♥', 'K♥']

  await page.getByRole('button', { name: '1/2' }).click()
  if (boardCards.length === 0) {
    await page.getByRole('button', { name: 'No board' }).click()
  } else {
    for (const card of boardCards) {
      await page.getByRole('button', { name: card, exact: true }).click()
    }
    await page.getByRole('button', { name: `Done (${boardCards.length})` }).click()
  }
  await page.getByRole('button', { name: heroPos, exact: true }).click()
  for (const card of holeCards) {
    await page.getByRole('button', { name: card, exact: true }).click()
  }
  await page.getByRole('button', { name: /Done/ }).click()
}

/**
 * Records a complete heads-up hand (no board, hero BTN A♥ K♠ calls, BB checks),
 * ending at AWAIT_ACTOR with Save / Showdown. BB is the lone villain → marked V.
 */
async function recordMinimalComplete(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♠', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Call' }).click()
  await page.getByRole('button', { name: 'BB', exact: true }).click()
  await page.getByRole('button', { name: 'Check' }).click()
}

test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await startNewHand(page)
})

// ── Stakes chip ───────────────────────────────────────────────────────────────

test('edit stakes chip — change 1/2 to 2/5', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()

  // Chip "1/2" should be visible
  await expect(page.getByRole('button', { name: '1/2', exact: true }).first()).toBeVisible()

  // Click the stakes chip (it appears in the recorded display, above the wizard)
  // The stakes chip is the button that shows just "1/2" with data-chip-id="stakes"
  await page.locator('[data-chip-id="stakes"]').click()

  // Preset picker appears
  await expect(page.getByRole('button', { name: '2/5', exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '2/5', exact: true }).first().click()

  // Stakes chip should now show 2/5
  await expect(page.locator('[data-chip-id="stakes"]')).toHaveText('2/5')
})

test('edit stakes chip — undo reverts to original', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()

  await page.locator('[data-chip-id="stakes"]').click()
  await page.getByRole('button', { name: '5/10', exact: true }).first().click()

  await expect(page.locator('[data-chip-id="stakes"]')).toHaveText('5/10')

  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.locator('[data-chip-id="stakes"]')).toHaveText('1/2')
})

// ── Board card chips ──────────────────────────────────────────────────────────

test('edit board card — swap A♠ for 2♣', async ({ page }) => {
  await recordUpToPreflop(page)

  // The first board card chip is board:0
  await page.locator('[data-chip-id="board:0"]').click()

  // Card grid should open — A♠ is selectable (it's the card being edited), 2♣ is available
  // Click 2♣ to swap
  await page.getByRole('button', { name: '2♣', exact: true }).click()

  // board:0 chip text should change to 2♣ glyph
  await expect(page.locator('[data-chip-id="board:0"]')).toHaveText('2♣')
})

test('edit board card — edited card remains selectable in picker', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="board:0"]').click()

  // A♠ should be enabled (not disabled), since it's the card being edited
  await expect(page.locator('[data-testid="card-picker"]').getByRole('button', { name: 'A♠', exact: true })).toBeEnabled()
})

test('edit board card — sibling board cards are disabled in picker', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="board:0"]').click()

  const picker = page.locator('[data-testid="card-picker"]')
  // K♠ and Q♠ are the other board cards — they must be disabled
  await expect(picker.getByRole('button', { name: 'K♠', exact: true })).toBeDisabled()
  await expect(picker.getByRole('button', { name: 'Q♠', exact: true })).toBeDisabled()
})

test('edit board card — undo reverts swap', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="board:0"]').click()
  await page.getByRole('button', { name: '2♣', exact: true }).click()
  await expect(page.locator('[data-chip-id="board:0"]')).toHaveText('2♣')

  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.locator('[data-chip-id="board:0"]')).toHaveText('A♠')
})

// ── Hero position chip ────────────────────────────────────────────────────────

test('edit hero position — change BTN to CO', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="hero:pos"]').click()

  // Position picker appears with hero positions
  await expect(page.getByRole('button', { name: 'CO', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'CO', exact: true }).click()

  await expect(page.locator('[data-chip-id="hero:pos"]')).toHaveText('H (CO)')
})

test('edit hero position — undo reverts', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="hero:pos"]').click()
  await page.getByRole('button', { name: 'SB', exact: true }).click()
  await expect(page.locator('[data-chip-id="hero:pos"]')).toHaveText('H (SB)')

  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.locator('[data-chip-id="hero:pos"]')).toHaveText('H (BTN)')
})

// ── Hero card chips ───────────────────────────────────────────────────────────

test('edit hero card 0 — swap A♥ for T♦', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="hero:card:0"]').click()

  const picker = page.locator('[data-testid="card-picker"]')
  // A♥ selectable; click T♦
  await expect(picker.getByRole('button', { name: 'A♥', exact: true })).toBeEnabled()
  await picker.getByRole('button', { name: 'T♦', exact: true }).click()

  // T < K, so after sorting K♥ moves to slot 0 and T♦ to slot 1
  await expect(page.locator('[data-chip-id="hero:card:0"]')).toHaveText('K♥')
  await expect(page.locator('[data-chip-id="hero:card:1"]')).toHaveText('T♦')
})

test('edit hero card 1 — swap K♥ for J♣', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="hero:card:1"]').click()
  await page.getByRole('button', { name: 'J♣', exact: true }).click()

  await expect(page.locator('[data-chip-id="hero:card:1"]')).toHaveText('J♣')
})

test('edit hero card — board cards are disabled in picker', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="hero:card:0"]').click()

  const picker = page.locator('[data-testid="card-picker"]')
  // Board cards A♠, K♠, Q♠ should all be disabled
  await expect(picker.getByRole('button', { name: 'A♠', exact: true })).toBeDisabled()
  await expect(picker.getByRole('button', { name: 'K♠', exact: true })).toBeDisabled()
  await expect(picker.getByRole('button', { name: 'Q♠', exact: true })).toBeDisabled()
})

test('edit hero card — undo reverts', async ({ page }) => {
  await recordUpToPreflop(page)

  await page.locator('[data-chip-id="hero:card:0"]').click()
  await page.getByRole('button', { name: 'T♦', exact: true }).click()
  // T < K so K♥ is now at slot 0
  await expect(page.locator('[data-chip-id="hero:card:0"]')).toHaveText('K♥')

  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.locator('[data-chip-id="hero:card:0"]')).toHaveText('A♥')
})

// ── Action chip — position edits ──────────────────────────────────────────────

test('edit position — verb still legal applies in one tap', async ({ page }) => {
  await recordUpToPreflop(page)
  // Record one action so the action chip exists
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()

  // Call is legal for CO too — the position-only edit applies immediately.
  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'CO', exact: true }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('CO calls')
  await expect(page.getByText(/Editing:/)).not.toBeVisible()
})

test('edit position — verb illegal for new position requires a verb tap (BB option)', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()

  // Call is not legal for the unraised BB (BB option): the overlay stays open
  // with BB highlighted, the verb deselected, and the model untouched.
  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'BB', exact: true }).click()
  await expect(page.getByText(/Editing:/)).toBeVisible()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')

  await step.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('BB checks')
})

test('edit position — cancel after an invalidating position tap is a no-op', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'BB', exact: true }).click()
  await page.getByTestId('cancel-edit').click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')
})

test('edit position — undo reverts', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'CO', exact: true }).click()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('CO calls')

  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')
})

// ── Action chip — verb edits ──────────────────────────────────────────────────

test('edit verb — change Call to Fold', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()

  // Verb picker — facing implicit BB bet, so: Call, Raise, Fold, All In
  await expect(page.getByRole('button', { name: 'Fold' })).toBeVisible()
  await page.getByRole('button', { name: 'Fold' }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) folds')
})

test('edit verb — change Call to Raise with amount', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.getByRole('button', { name: 'Raise' }).click()

  // Amount sub-step
  await page.locator('input[type="number"]').fill('25')
  await page.getByRole('button', { name: 'OK' }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) raises 25')
})

test('edit verb — facing a bet shows call/raise/fold/all-in', async ({ page }) => {
  await recordUpToPreflop(page)
  // CO raises ahead of the hero so the hero (BTN) can respond to a bet.
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'CO', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Raise', exact: true }).click()
  await page.locator('input[type="number"]').fill('20')
  await page.getByRole('button', { name: 'OK' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Call', exact: true }).click()

  // Now edit the hero's action (action:Preflop:1, facing a bet)
  await page.locator('[data-chip-id="action:Preflop:1"]').click()

  const step = page.locator('[data-testid="step-content"]')
  await expect(step.getByRole('button', { name: 'Call', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'Raise', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'Fold', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'All In', exact: true })).toBeVisible()
  // "Bet" and "Check" should NOT appear (they're invalid when facing a bet)
  await expect(step.getByRole('button', { name: 'Bet', exact: true })).not.toBeVisible()
  await expect(step.getByRole('button', { name: 'Check', exact: true })).not.toBeVisible()
})

test('edit verb — change raise amount', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true}).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Raise', exact: true }).click()
  await page.locator('input[type="number"]').fill('30')
  await page.getByRole('button', { name: 'OK' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Raise', exact: true }).click()
  await page.locator('input[type="number"]').fill('50')
  await page.getByRole('button', { name: 'OK' }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) raises 50')
})

test('edit verb — change Raise to Call (drops amount)', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Raise' }).click()
  await page.locator('input[type="number"]').fill('30')
  await page.getByRole('button', { name: 'OK' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.getByRole('button', { name: 'Call' }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')
})

test('edit verb — all in with amount (enter amount)', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.getByRole('button', { name: 'All In' }).click()

  // Optional amount sub-step with Skip
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()
  await page.locator('input[type="number"]').fill('200')
  await page.getByRole('button', { name: 'OK' }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) all in 200')
})

test('edit verb — all in with skip (no amount)', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.getByRole('button', { name: 'All In' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) all in')
})

test('edit verb — undo reverts change', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.getByRole('button', { name: 'Fold' }).click()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) folds')

  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')
})

// ── Cancel edit ───────────────────────────────────────────────────────────────

test('cancel edit — closes overlay without change', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await expect(page.getByText(/Editing:/)).toBeVisible()

  await page.getByTestId('cancel-edit').click()

  // Chip still shows the call; wizard restored
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')
  await expect(page.getByText(/Editing:/)).not.toBeVisible()
})

// ── Showdown actor chip ───────────────────────────────────────────────────────

test('edit showdown actor — restricted to players in the hand', async ({ page }) => {
  await recordMinimalComplete(page)
  await page.getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Wins' }).click()

  await page.locator('[data-chip-id="showdown:0:actor"]').click()

  // Only players still in the hand (BTN, BB) are offered — never folded/absent seats like CO.
  const step = page.locator('[data-testid="step-content"]')
  await expect(step.getByRole('button', { name: 'BB', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'CO', exact: true })).not.toBeVisible()

  // The lone villain is shown with its derived marker once selected.
  await step.getByRole('button', { name: 'BB', exact: true }).click()
  await expect(page.locator('[data-chip-id="showdown:0:actor"]')).toHaveText('V (BB)')
})

// ── Showdown verb chip ────────────────────────────────────────────────────────

test('edit showdown verb — change Wins to Loses', async ({ page }) => {
  await recordMinimalComplete(page)
  await page.getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true}).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Wins' }).click()

  await page.locator('[data-chip-id="showdown:0:verb"]').click()
  await page.getByRole('button', { name: 'Loses' }).click()

  await expect(page.locator('[data-chip-id="showdown:0:verb"]')).toHaveText('Loses')
})

// ── Showdown card chips ───────────────────────────────────────────────────────

test('edit showdown card 0 — swap to different card', async ({ page }) => {
  await recordMinimalComplete(page)
  await page.getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Shows' }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '3♣', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()

  // [2♣, 3♣] is stored sorted as [3♣, 2♣]; card:0 is 3♣
  await page.locator('[data-chip-id="showdown:0:card:0"]').click()

  const picker = page.locator('[data-testid="card-picker"]')
  // 3♣ is selectable (the card being edited), 2♣ is disabled (sibling)
  await expect(picker.getByRole('button', { name: '3♣', exact: true })).toBeEnabled()
  await expect(picker.getByRole('button', { name: '2♣', exact: true })).toBeDisabled()

  await picker.getByRole('button', { name: '4♣', exact: true }).click()

  // 4♣ > 2♣ so 4♣ stays at slot 0
  await expect(page.locator('[data-chip-id="showdown:0:card:0"]')).toHaveText('4♣')
})

test('edit showdown card 1 — swap', async ({ page }) => {
  await recordMinimalComplete(page)
  await page.getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Shows' }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '3♣', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()

  // [2♣, 3♣] stored sorted as [3♣, 2♣]; card:1 is 2♣
  await page.locator('[data-chip-id="showdown:0:card:1"]').click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '5♣', exact: true }).click()

  // 5♣ > 3♣ so 5♣ moves to slot 0, 3♣ to slot 1
  await expect(page.locator('[data-chip-id="showdown:0:card:0"]')).toHaveText('5♣')
  await expect(page.locator('[data-chip-id="showdown:0:card:1"]')).toHaveText('3♣')
})

// ── Card ordering — highest rank displayed first ──────────────────────────────

test('card ordering — hero cards entered low-high are displayed high-low', async ({ page }) => {
  // Enter K♥ before A♥ (lower rank first)
  await recordUpToPreflop(page, { holeCards: ['K♥', 'A♥'] })

  // A > K so A♥ should be at slot 0 regardless of entry order
  await expect(page.locator('[data-chip-id="hero:card:0"]')).toHaveText('A♥')
  await expect(page.locator('[data-chip-id="hero:card:1"]')).toHaveText('K♥')
})

test('card ordering — showdown cards entered low-high are displayed high-low', async ({ page }) => {
  await recordMinimalComplete(page)
  await page.getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Shows' }).click()
  // Enter 2♣ before 9♦ (lower rank first)
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '9♦', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()

  // 9 > 2 so 9♦ should be at slot 0 regardless of entry order
  await expect(page.locator('[data-chip-id="showdown:0:card:0"]')).toHaveText('9♦')
  await expect(page.locator('[data-chip-id="showdown:0:card:1"]')).toHaveText('2♣')
})

// ── Save after edits ──────────────────────────────────────────────────────────

// ── Note chip ─────────────────────────────────────────────────────────────────

test('edit note chip — change note text', async ({ page }) => {
  await recordMinimalComplete(page)
  await page.getByRole('button', { name: /type manually/ }).click()
  await page.getByPlaceholder('note to add…').fill('original note')
  await page.getByRole('button', { name: 'Add note' }).click()

  await expect(page.locator('[data-chip-id="note:0"]')).toBeVisible()

  await page.locator('[data-chip-id="note:0"]').click()
  await expect(page.getByText(/Editing:/)).toBeVisible()

  const noteInput = page.getByPlaceholder('note…')
  await noteInput.clear()
  await noteInput.fill('updated note')
  await page.getByRole('button', { name: 'OK' }).click()

  await expect(page.locator('[data-chip-id="note:0"]')).toHaveText('# updated note')
})

// ── Save after edits ──────────────────────────────────────────────────────────

test('save succeeds after chip edits', async ({ page }) => {
  await recordUpToPreflop(page)
  await page.getByRole('button', { name: 'H', exact: true}).click()
  await page.getByRole('button', { name: 'Call' }).click()

  // Edit the verb
  await page.locator('[data-chip-id="action:Preflop:0"]').click()
  await page.getByRole('button', { name: 'Fold' }).click()

  // Save
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
})
