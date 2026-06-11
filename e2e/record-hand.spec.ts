import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await page.getByRole('button', { name: '+ New hand' }).click()
})

// Test 7
test('Stakes presets (1/2, 2/5, 5/5, 5/10, 10/20) are visible on the board step', async ({ page }) => {
  for (const s of ['1/2', '2/5', '5/5', '5/10', '10/20']) {
    await expect(page.getByRole('button', { name: s })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
})

// Test 8
test('Clicking a stakes preset selects it without leaving the board step', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
})

// Test 9
test('Recording starts directly at the board picker', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
  await expect(page.locator('textarea')).not.toBeVisible()
})

// Test 10
test('Board card picker shows a grid of cards', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'A♠' })).toBeVisible()
  await expect(page.getByRole('button', { name: '2♥' })).toBeVisible()
})

// Test 11
test('Selecting 3 board cards enables the board "Done" button', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'A♠' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: 'Q♠' }).click()
  await expect(page.getByRole('button', { name: 'Done (3)' })).toBeEnabled()
})

// Test 12
test('Board cards already selected as board cards are disabled in the hole card picker', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: '2♠' }).click()
  await page.getByRole('button', { name: '3♠' }).click()
  await page.getByRole('button', { name: '4♠' }).click()
  await page.getByRole('button', { name: 'Done (3)' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await expect(page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♠', exact: true })).toBeDisabled()
})

// Test 13
test('Clicking a hero position selects it and advances the wizard', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await expect(page.getByText(/Hero hole cards/)).toBeVisible()
})

// Test 14
test('Selecting 2 hole cards enables the Save button (minimal hand)', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await expect(page.getByRole('button', { name: /Done/ })).toBeEnabled()
})

// Test 15
test('Save button is disabled before hole cards are entered', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await expect(page.getByRole('button', { name: 'Pick 2 cards' })).toBeDisabled()
})

// Test 16
test('Undo button reverts the most recent wizard step', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
})

// Test 17
test('Free-text toggle ("···") replaces the wizard with a textarea', async ({ page }) => {
  await page.getByRole('button', { name: /type manually/ }).click()
  await expect(page.getByPlaceholder('note to add…')).toBeVisible()
})

// Test 18
test('Saving a hand navigates to the hand detail view', async ({ page }) => {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Call' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
})

test('Custom stakes can be entered and appear in hand detail and history', async ({ page }) => {
  await page.getByRole('button', { name: 'Custom...' }).click()
  await page.getByTestId('custom-stakes-sb').fill('3')
  await page.getByTestId('custom-stakes-bb').fill('5')
  await page.getByRole('button', { name: 'Set' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Call' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByText('3/5 NLH')).toBeVisible()
  await page.getByRole('button', { name: '← History' }).click()
  await expect(page.getByText('3/5 NLH')).toBeVisible()
})

test('Custom stakes SB > BB is rejected (Set button disabled)', async ({ page }) => {
  await page.getByRole('button', { name: 'Custom...' }).click()
  await page.getByTestId('custom-stakes-sb').fill('10')
  await page.getByTestId('custom-stakes-bb').fill('5')
  await expect(page.getByRole('button', { name: 'Set' })).toBeDisabled()
})

test('after saving a hand with custom stakes, the next new hand has those custom stakes pre-selected', async ({ page }) => {
  // Record first hand with custom 3/5 stakes
  await page.getByRole('button', { name: 'Custom...' }).click()
  await page.getByTestId('custom-stakes-sb').fill('3')
  await page.getByTestId('custom-stakes-bb').fill('5')
  await page.getByRole('button', { name: 'Set' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Call' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await page.getByRole('button', { name: '← History' }).click()
  // Start a new hand — custom stakes 3/5 should be pre-selected
  await page.getByRole('button', { name: '+ New hand' }).click()
  await expect(page.getByRole('button', { name: '3/5' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'No board' })).toBeEnabled()
})

// ── Combined position + action panel (issue #53) ─────────────────────────────

/** Records stakes + no board + hero BTN A♥ K♠, ending on the Preflop combined panel. */
async function recordUpToPreflopPanel(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
}

test('position tap reveals the verb row without committing', async ({ page }) => {
  await recordUpToPreflopPanel(page)
  const step = page.locator('[data-testid="step-content"]')
  await expect(step.getByText('— pick a position first —')).toBeVisible()

  await step.getByRole('button', { name: 'H', exact: true }).click()

  await expect(step.getByRole('button', { name: 'Call', exact: true })).toBeVisible()
  // Nothing committed yet — no action chip exists.
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).not.toBeVisible()
})

test('verb tap commits one merged action chip', async ({ page }) => {
  await recordUpToPreflopPanel(page)
  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'H', exact: true }).click()
  await step.getByRole('button', { name: 'Call', exact: true }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) calls')
})

test('switching position before the verb recomputes the verb row (BB option)', async ({ page }) => {
  await recordUpToPreflopPanel(page)
  const step = page.locator('[data-testid="step-content"]')

  // Unraised BB has the option: Check, no Call.
  await step.getByRole('button', { name: 'BB', exact: true }).click()
  await expect(step.getByRole('button', { name: 'Check', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'Call', exact: true })).not.toBeVisible()

  // SB faces the implicit BB bet: Call, no Check.
  await step.getByRole('button', { name: 'SB', exact: true }).click()
  await expect(step.getByRole('button', { name: 'Call', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'Check', exact: true })).not.toBeVisible()
})

test('backing out of the amount sub-step leaves no partial action', async ({ page }) => {
  await recordUpToPreflopPanel(page)
  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'H', exact: true }).click()
  await step.getByRole('button', { name: 'Raise', exact: true }).click()

  await step.getByRole('button', { name: '← Back' }).click()

  // Back on the combined panel with the position still highlighted; nothing committed.
  await expect(step.getByRole('button', { name: 'Raise', exact: true })).toBeVisible()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).not.toBeVisible()
})

test('undo removes a whole action in one step', async ({ page }) => {
  await recordUpToPreflopPanel(page)
  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'H', exact: true }).click()
  await step.getByRole('button', { name: 'Raise', exact: true }).click()
  await page.locator('input[type="number"]').fill('20')
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).toHaveText('H (BTN) raises 20')

  await page.getByRole('button', { name: '← Undo' }).click()

  // The whole action is gone — no verbless actor chip left behind.
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).not.toBeVisible()
  await expect(step.getByText('— pick a position first —')).toBeVisible()
})

test('undo during the amount sub-step discards the pending action', async ({ page }) => {
  await recordUpToPreflopPanel(page)
  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'H', exact: true }).click()
  await step.getByRole('button', { name: 'Raise', exact: true }).click()

  await page.getByRole('button', { name: '← Undo' }).click()

  // The pending action is discarded; the previously recorded steps are untouched.
  await expect(step.getByText('— pick a position first —')).toBeVisible()
  await expect(page.locator('[data-chip-id="hero:pos"]')).toHaveText('H (BTN)')
  await expect(page.locator('[data-chip-id="action:Preflop:0"]')).not.toBeVisible()
})

test('new hand inherits stakes from the most recently saved hand', async ({ page }) => {
  // Record first hand with 2/5
  await page.getByRole('button', { name: '2/5' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Call' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await page.getByRole('button', { name: '← History' }).click()
  // Start second hand without touching stakes
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'CO' }).click()
  await page.getByRole('button', { name: 'A♠' }).click()
  await page.getByRole('button', { name: 'Q♥' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Call' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await page.getByRole('button', { name: '← History' }).click()
  // Both hands should show 2/5 NLH
  await expect(page.getByText('2/5 NLH')).toHaveCount(2)
})
