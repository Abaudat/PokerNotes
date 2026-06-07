import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

/** Records a new hand with a 3-card board, BTN, A♥ K♥, Hero checks preflop. */
async function recordPreflopWithBoard(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ New hand' }).click()
  for (const card of ['A♠', 'K♠', 'Q♠']) {
    await page.getByRole('button', { name: card, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Done (3)' }).click()
  await page.getByRole('button', { name: 'BTN', exact: true }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♥', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Check' }).click()
}

test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
})

test('→ Flop button appears after a preflop action when board has 3 cards', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await expect(
    page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' })
  ).toBeVisible()
})

test('clicking → Flop advances wizard to the Flop step', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' }).click()
  await expect(page.locator('[data-testid="step-content"]').getByText('Flop')).toBeVisible()
})

test('recording Preflop + Flop actions then saving succeeds', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
})

test('hand view shows Flop section after recording Flop actions', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Bet' }).click()
  await page.locator('input[type="number"]').fill('30')
  await page.getByRole('button', { name: 'OK' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
  await expect(page.getByText('Flop', { exact: true })).toBeVisible()
  await expect(page.getByText('bets')).toBeVisible()
  await expect(page.getByText('$30')).toBeVisible()
})

test('board-card-add (+) chip is visible when board has fewer than 5 cards', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await expect(page.locator('[data-chip-id="board:add"]')).toBeVisible()
})

test('clicking board-card-add adds a Turn card to the board', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Check' }).click()
  await page.locator('[data-chip-id="board:add"]').click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  await expect(page.locator('[data-chip-id="board:3"]')).toHaveText('2♣')
})

test('→ Turn appears after adding a Turn card when on Flop', async ({ page }) => {
  await recordPreflopWithBoard(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Check' }).click()
  // Board has 3 cards — → Turn not yet visible
  await expect(
    page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Turn' })
  ).not.toBeVisible()
  // Add a Turn card
  await page.locator('[data-chip-id="board:add"]').click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  // → Turn should now appear (board has 4 cards)
  await expect(
    page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Turn' })
  ).toBeVisible()
})
