import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid, recordMinimalHand } from './helpers'

// Seeded hand: no stakes, no board, BTN, A♥K♠, Hero checks preflop
// Opens the recording editor via HandView → Edit button
test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await recordMinimalHand(page)
  await page.getByRole('button', { name: 'Edit' }).click()
})

// Test 37
test('Recording screen shows the recorded hand\'s chips pre-populated', async ({ page }) => {
  await expect(page.locator('[data-chip-id="hero:pos"]')).toHaveText('H (BTN)')
  await expect(page.locator('[data-chip-id="hero:card:0"]')).toHaveText('A♥')
  await expect(page.locator('[data-chip-id="hero:card:1"]')).toHaveText('K♠')
})

// Test 38
test('Save hand button is available for a complete pre-populated hand', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Save hand' })).toBeVisible()
})

// Test 41
test('Saving returns to the history list', async ({ page }) => {
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
})

// Test 42
test('The updated hand appears with new content in the history list', async ({ page }) => {
  await page.locator('[data-chip-id="hero:pos"]').click()
  await page.getByRole('button', { name: 'CO', exact: true }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await expect(page.getByText('CO').first()).toBeVisible()
})

// Test 43
test('Cancel returns to history without saving', async ({ page }) => {
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
})

// Test 44
test('The hand is unchanged in history after cancel', async ({ page }) => {
  await page.locator('[data-chip-id="hero:pos"]').click()
  await page.getByRole('button', { name: 'CO', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('BTN').first()).toBeVisible()
})
