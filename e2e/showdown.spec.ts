import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

/** Records up to preflop (no board, BTN, A♥ K♠, Hero checks) — ends at AWAIT_ACTOR with Save/Showdown available. */
async function recordPreflopForShowdown(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN', exact: true }).click()
  await page.getByRole('button', { name: 'A♥', exact: true }).click()
  await page.getByRole('button', { name: 'K♠', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'H', exact: true }).click()
  await page.locator('[data-testid="step-content"]').getByRole('button', { name: 'Check' }).click()
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
