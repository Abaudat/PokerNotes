import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid, recordRichHand } from './helpers'

// Seeded hand: 1/2 stakes, board 2♠3♠4♠, BTN, A♥K♥, Hero raises $20 preflop
test.beforeEach(async ({ page }) => {
  await clearFirestoreHands(await getTestUserUid())
  await page.goto('/')
  await recordRichHand(page)
})

// Test 28
test('View shows hero hole cards with suit glyphs', async ({ page }) => {
  await expect(page.getByText('A♥')).toBeVisible()
  await expect(page.getByText('K♥')).toBeVisible()
})

// Test 29
test('View shows board cards with suit glyphs', async ({ page }) => {
  await expect(page.getByText('2♠')).toBeVisible()
  await expect(page.getByText('3♠')).toBeVisible()
  await expect(page.getByText('4♠')).toBeVisible()
})

// Test 30
test('View shows stakes in the metadata line', async ({ page }) => {
  await expect(page.getByText('1/2 NLH')).toBeVisible()
})

// Test 31
test('View shows the hero position', async ({ page }) => {
  await expect(page.getByText('BTN')).toBeVisible()
})

// Test 32
test('View shows a preflop action\'s actor name', async ({ page }) => {
  await expect(page.getByText('Hero', { exact: true })).toBeVisible()
})

// Test 33
test('View shows a preflop action\'s verb', async ({ page }) => {
  await expect(page.getByText('bets')).toBeVisible()
})

// Test 34
test('View shows a preflop action\'s amount when present', async ({ page }) => {
  await expect(page.getByText('$20')).toBeVisible()
})

// Test 35
test('Back button returns to the history list', async ({ page }) => {
  await page.getByRole('button', { name: '← History' }).click()
  await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
})

// Test 36
test('Edit button opens the hand in the recording editor', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit hand' })).toBeVisible()
})
