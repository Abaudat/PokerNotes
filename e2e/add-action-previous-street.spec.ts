/**
 * E2E tests: adding a new action to a previously-recorded street.
 * Covers the three scenarios from issue #48.
 */
import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

async function startNewHand(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ New hand' }).click()
}

/**
 * Records board (3 cards) + hero BTN + hole cards A♥ K♥, then records
 * Preflop: UTG raise 10, CO call, and advances to the Flop.
 * Leaves BTN / SB / BB as implicit folders (none have responded to the raise).
 */
async function recordPreflopUTGRaiseCOCallThenFlop(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '1/2' }).click()
  for (const card of ['A♠', 'K♠', 'Q♠']) {
    await page.getByRole('button', { name: card, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Done (3)' }).click()
  await page.getByRole('button', { name: 'BTN', exact: true }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♥', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()

  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'UTG', exact: true }).click()
  await step.getByRole('button', { name: 'Raise', exact: true }).click()
  await page.locator('input[type="number"]').fill('10')
  await page.getByRole('button', { name: 'OK' }).click()
  await step.getByRole('button', { name: 'CO', exact: true }).click()
  await step.getByRole('button', { name: 'Call', exact: true }).click()
  await step.getByRole('button', { name: '→ Flop' }).click()
}

/**
 * Records board (4 cards) + hero BTN + hole cards A♥ K♥, then records:
 *   Preflop: UTG raise 10, CO call, BB call
 *   Flop:    BB bet 15, CO call  (UTG is implicitly folded)
 * and advances to the Turn.
 */
async function recordUpToTurnWithFullFlopAction(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '1/2' }).click()
  for (const card of ['A♠', 'K♠', 'Q♠', 'J♠']) {
    await page.getByRole('button', { name: card, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Done (4)' }).click()
  await page.getByRole('button', { name: 'BTN', exact: true }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♥', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()

  const step = page.locator('[data-testid="step-content"]')
  // Preflop: UTG raise 10, CO call, BB call
  await step.getByRole('button', { name: 'UTG', exact: true }).click()
  await step.getByRole('button', { name: 'Raise', exact: true }).click()
  await page.locator('input[type="number"]').fill('10')
  await page.getByRole('button', { name: 'OK' }).click()
  await step.getByRole('button', { name: 'CO', exact: true }).click()
  await step.getByRole('button', { name: 'Call', exact: true }).click()
  await step.getByRole('button', { name: 'BB', exact: true }).click()
  await step.getByRole('button', { name: 'Call', exact: true }).click()
  await step.getByRole('button', { name: '→ Flop' }).click()
  // Flop: BB bet 15, CO call  (UTG implicitly folded — CO acts before UTG responds)
  await step.getByRole('button', { name: 'BB', exact: true }).click()
  await step.getByRole('button', { name: 'Bet', exact: true }).click()
  await page.locator('input[type="number"]').fill('15')
  await page.getByRole('button', { name: 'OK' }).click()
  await step.getByRole('button', { name: 'CO', exact: true }).click()
  await step.getByRole('button', { name: 'Call', exact: true }).click()
  await step.getByRole('button', { name: '→ Turn' }).click()
}

test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await startNewHand(page)
})

// ===========================================================================
// Scenario 1: Possible new preflop action
// ===========================================================================

test('+ button appears on Preflop when implicit folders remain after advancing to Flop', async ({ page }) => {
  await recordPreflopUTGRaiseCOCallThenFlop(page)
  await expect(page.getByTestId('add-action-Preflop')).toBeVisible()
})

test('add-action actor picker for Preflop shows BTN/SB/BB but not UTG or CO', async ({ page }) => {
  await recordPreflopUTGRaiseCOCallThenFlop(page)
  await page.getByTestId('add-action-Preflop').click()

  const step = page.locator('[data-testid="step-content"]')
  await expect(step.getByRole('button', { name: 'H', exact: true })).toBeVisible()   // BTN = hero
  await expect(step.getByRole('button', { name: 'SB', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'BB', exact: true })).toBeVisible()
  await expect(step.getByRole('button', { name: 'UTG', exact: true })).not.toBeVisible()
  await expect(step.getByRole('button', { name: 'CO', exact: true })).not.toBeVisible()
})

test('adding a new action to Preflop appends one merged action chip', async ({ page }) => {
  await recordPreflopUTGRaiseCOCallThenFlop(page)
  await page.getByTestId('add-action-Preflop').click()

  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'SB', exact: true }).click()
  await step.getByRole('button', { name: 'Fold', exact: true }).click()

  await expect(page.locator('[data-chip-id="action:Preflop:2"]')).toHaveText('SB folds')
})

test('cancelling the add-action panel mid-way leaves the street unchanged', async ({ page }) => {
  await recordPreflopUTGRaiseCOCallThenFlop(page)
  await page.getByTestId('add-action-Preflop').click()

  const step = page.locator('[data-testid="step-content"]')
  await step.getByRole('button', { name: 'SB', exact: true }).click()
  await step.getByRole('button', { name: 'Cancel', exact: true }).click()

  // No third Preflop action was created (the old flow left a verbless trailing action).
  await expect(page.locator('[data-chip-id="action:Preflop:2"]')).not.toBeVisible()
})

// ===========================================================================
// Scenario 2: Impossible new flop action
// ===========================================================================

test('no + button on Flop when all actors have responded to the bet', async ({ page }) => {
  await recordUpToTurnWithFullFlopAction(page)
  await expect(page.getByTestId('add-action-Flop')).not.toBeVisible()
})

// ===========================================================================
// Scenario 3: Editing a previous-street actor reveals a new + button
// ===========================================================================

test('+ button appears on Flop after editing an actor to create an implicit fold', async ({ page }) => {
  await recordUpToTurnWithFullFlopAction(page)

  // Edit Flop action 1: CO call → UTG call (CO is now implicitly folded).
  // Call is still legal for UTG, so the position-only edit applies in one tap.
  await page.locator('[data-chip-id="action:Flop:1"]').click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'UTG', exact: true }).click()

  await expect(page.getByTestId('add-action-Flop')).toBeVisible()
})

test('CO can be added to Flop and recorded as a fold after editing Flop actor to UTG', async ({ page }) => {
  await recordUpToTurnWithFullFlopAction(page)

  // Edit Flop action 1: CO → UTG
  await page.locator('[data-chip-id="action:Flop:1"]').click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'UTG', exact: true }).click()

  // Add CO's action via the + button
  await page.getByTestId('add-action-Flop').click()
  const step = page.locator('[data-testid="step-content"]')
  await expect(step.getByRole('button', { name: 'CO', exact: true })).toBeVisible()
  await step.getByRole('button', { name: 'CO', exact: true }).click()
  await step.getByRole('button', { name: 'Fold', exact: true }).click()

  await expect(page.locator('[data-chip-id="action:Flop:2"]')).toHaveText('CO folds')
})
