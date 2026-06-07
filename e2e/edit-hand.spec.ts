import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid, recordMinimalHand } from './helpers'

// Seeded hand: no stakes, no board, BTN, A♥K♠, Hero checks preflop
test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await recordMinimalHand(page)
  await page.getByRole('button', { name: 'Edit' }).click()
})

// Test 37
test('Edit textarea is pre-filled with the hand\'s current raw text', async ({ page }) => {
  const value = await page.locator('textarea').inputValue()
  expect(value).toContain('BTN')
  expect(value).toContain('AhKs')
})

// Test 38
test('Valid edited text shows a success indicator', async ({ page }) => {
  await expect(page.getByText('✓ Valid hand')).toBeVisible()
})

// Test 39
test('Syntactically invalid text shows a parse error message', async ({ page }) => {
  await page.locator('textarea').fill('invalid text here')
  await expect(page.getByText(/⚠/)).toBeVisible()
})

// Test 40
test('Save button is disabled when the text is invalid', async ({ page }) => {
  await page.locator('textarea').fill('invalid text here')
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})

// Test 41
test('Saving updated text returns to the history list', async ({ page }) => {
  await page.locator('textarea').fill('Board:\nHero: BTN AsQh\nPreflop: H x')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
})

// Test 42
test('The updated hand appears with new content in the history list', async ({ page }) => {
  await page.locator('textarea').fill('Board:\nHero: BTN AsQh\nPreflop: H x')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('A♠ Q♥', { exact: true })).toBeVisible()
})

// Test 43
test('Cancel returns to history without saving', async ({ page }) => {
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
})

// Test 44
test('The hand is unchanged in history after cancel', async ({ page }) => {
  await page.locator('textarea').fill('Board:\nHero: CO AsQh\nPreflop: H x')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('A♥ K♠', { exact: true })).toBeVisible()
})
