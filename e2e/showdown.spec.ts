import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

/** Records up to preflop (no board, BTN, A♥ K♠, Hero calls) — ends at AWAIT_ACTOR with Save/Showdown available. */
async function recordPreflopForShowdown(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN', exact: true }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♠', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Call' }).click()
}

test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
})

test('→ Showdown button appears after recording preflop actions', async ({ page }) => {
  await recordPreflopForShowdown(page)
  await expect(
    page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Showdown' })
  ).toBeVisible()
})

test('recording showdown: villain wins — save succeeds', async ({ page }) => {
  await recordPreflopForShowdown(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Wins' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
})

test('recording showdown: villain shows two cards — save succeeds', async ({ page }) => {
  await recordPreflopForShowdown(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Shows' }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '3♣', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
})

test('hand view shows Showdown section after recording a win', async ({ page }) => {
  await recordPreflopForShowdown(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Wins' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
  await expect(page.getByText('Showdown', { exact: true })).toBeVisible()
  await expect(page.getByText('wins')).toBeVisible()
})

test('showdown suggests only active players: CO implicitly folded on flop is excluded', async ({ page }) => {
  // Preflop: HJ r 15, CO c, BB c — all three stay in
  // Flop: HJ b 15, BB c — CO never responds to the bet → implicitly folded
  // At showdown only HJ, BB, V, H should be offered; CO must not appear
  await page.getByRole('button', { name: '+ New hand' }).click()
  for (const card of ['2♠', '7♥', 'Q♦']) {
    await page.getByRole('button', { name: card, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Done (3)' }).click()
  await page.getByRole('button', { name: 'BTN', exact: true }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♠', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()

  // Preflop
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'HJ', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Raise' }).click()
  await page.locator('input[type="number"]').fill('15')
  await page.getByRole('button', { name: 'OK' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'CO', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Call' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'BB', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Call' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Flop' }).click()

  // Flop
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'HJ', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Bet' }).click()
  await page.locator('input[type="number"]').fill('15')
  await page.getByRole('button', { name: 'OK' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'BB', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Call' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Showdown' }).click()

  const stepContent = page.locator('[data-testid="step-content"]')
  await expect(stepContent.getByRole('button', { name: 'HJ', exact: true })).toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'BB', exact: true })).toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'V', exact: true })).toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'H', exact: true })).toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'CO', exact: true })).not.toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'UTG', exact: true })).not.toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'UTG+1', exact: true })).not.toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'UTG+2', exact: true })).not.toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'UTG+3', exact: true })).not.toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'BTN', exact: true })).not.toBeVisible()
  await expect(stepContent.getByRole('button', { name: 'SB', exact: true })).not.toBeVisible()
})

test('hand view shows showdown cards when villain shows', async ({ page }) => {
  await recordPreflopForShowdown(page)
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: '→ Showdown' }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'V', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Shows' }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '2♣', exact: true }).click()
  await page.locator('[data-testid="card-picker"]').getByRole('button', { name: '3♣', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
  await expect(page.getByText('shows')).toBeVisible()
  await expect(page.getByText('2♣')).toBeVisible()
})
