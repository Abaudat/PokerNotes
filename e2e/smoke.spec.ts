import { test, expect } from '@playwright/test'

test('app loads and shows PokerNotes heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'PokerNotes' })).toBeVisible()
})

test('authenticated user sees the hand history section', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
})
