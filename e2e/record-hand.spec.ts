import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid } from './helpers'

test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await page.getByRole('button', { name: '+ New hand' }).click()
})

// Test 7
test('Stakes picker shows preset options ($1/$2, $2/$5, $5/$10, $10/$20) and a Skip button', async ({ page }) => {
  for (const s of ['$1/$2', '$2/$5', '$5/$10', '$10/$20']) {
    await expect(page.getByRole('button', { name: s })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()
})

// Test 8
test('Clicking a stakes preset advances the wizard to the next step', async ({ page }) => {
  await page.getByRole('button', { name: '$1/$2' }).click()
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
})

// Test 9
test('Clicking Skip advances the wizard without setting stakes', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
  await expect(page.locator('textarea')).not.toBeVisible()
})

// Test 10
test('Board card picker shows a grid of cards', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('button', { name: 'A♠' })).toBeVisible()
  await expect(page.getByRole('button', { name: '2♥' })).toBeVisible()
})

// Test 11
test('Selecting 3 board cards enables the board "Done" button', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'A♠' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: 'Q♠' }).click()
  await expect(page.getByRole('button', { name: 'Done (3)' })).toBeEnabled()
})

// Test 12
test('Board cards already selected as board cards are disabled in the hole card picker', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: '2♠' }).click()
  await page.getByRole('button', { name: '3♠' }).click()
  await page.getByRole('button', { name: '4♠' }).click()
  await page.getByRole('button', { name: 'Done (3)' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await expect(page.getByRole('button', { name: '2♠' })).toBeDisabled()
})

// Test 13
test('Clicking a hero position selects it and advances the wizard', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await expect(page.getByText(/Hero hole cards/)).toBeVisible()
})

// Test 14
test('Selecting 2 hole cards enables the Save button (minimal hand)', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await expect(page.getByRole('button', { name: /Done/ })).toBeEnabled()
})

// Test 15
test('Save button is disabled before hole cards are entered', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await expect(page.getByRole('button', { name: 'Pick 2 cards' })).toBeDisabled()
})

// Test 16
test('Undo button reverts the most recent wizard step', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: '← Undo' }).click()
  await expect(page.getByRole('button', { name: 'No board' })).toBeVisible()
})

// Test 17
test('Free-text toggle ("···") replaces the wizard with a textarea', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: /type manually/ }).click()
  await expect(page.getByPlaceholder('note to add…')).toBeVisible()
})

// Test 18
test('Saving a hand navigates to the hand detail view', async ({ page }) => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
})
