import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid, recordHandWithStakes } from './helpers'

// Seeded hand: 1/2 stakes, no board, BTN, A♥K♠, Hero checks preflop
test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await recordHandWithStakes(page)
})

// Test 45
test('Clicking Export shows "✓ Copied!" feedback', async ({ page }) => {
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('button', { name: '✓ Copied!' })).toBeVisible()
})

// Test 46
test('"✓ Copied!" feedback disappears after ~2 seconds', async ({ page }) => {
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('button', { name: '✓ Copied!' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible({ timeout: 4000 })
})

// Test 47
test('Exported clipboard text contains at least one suit glyph (♠/♥/♦/♣)', async ({ page }) => {
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('button', { name: '✓ Copied!' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/[♠♥♦♣]/)
})

// Test 48
test("Exported clipboard text contains the hand's stakes", async ({ page }) => {
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('button', { name: '✓ Copied!' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('1/2')
})
