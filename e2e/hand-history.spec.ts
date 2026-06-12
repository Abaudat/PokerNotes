import { test, expect } from '@playwright/test'
import { clearFirestoreHands, getTestUserUid, recordMinimalHand, recordHandWithStakes } from './helpers'

test.describe('empty history', () => {
  test.beforeEach(async ({ page }) => {
    await clearFirestoreHands(await getTestUserUid())
    await page.goto('/')
  })

  // Test 19
  test('Shows an empty-state message when no hands have been recorded', async ({ page }) => {
    await expect(page.getByText('No hands yet.')).toBeVisible()
  })

  // Test 20
  test('"+ New hand" button opens the hand wizard', async ({ page }) => {
    await page.getByRole('button', { name: '+ New hand' }).click()
    await expect(page.getByRole('heading', { name: 'New hand' })).toBeVisible()
  })
})

test.describe('history with one hand', () => {
  test.beforeEach(async ({ page }) => {
    await clearFirestoreHands(await getTestUserUid())
    await page.goto('/')
    await recordHandWithStakes(page)
    await page.getByRole('button', { name: '← History' }).click()
  })

  // Test 21
  test('Hand card shows the hero cards with suit glyphs', async ({ page }) => {
    await expect(page.getByText('A♥ K♠', { exact: true })).toBeVisible()
  })

  // Test 22
  test('Hand card shows stakes when set', async ({ page }) => {
    await expect(page.getByText('1/2 NLH').first()).toBeVisible()
  })

  // Test 23
  test('Hand card shows the hero position', async ({ page }) => {
    await expect(page.getByText('BTN').first()).toBeVisible()
  })

  // Test 24
  test('Clicking a hand card navigates to the hand detail view', async ({ page }) => {
    await page.getByText('A♥ K♠', { exact: true }).click()
    await expect(page.getByRole('button', { name: '← History' })).toBeVisible()
  })

  // Test 49
  test('Hands recorded today are grouped under a "Today" date header', async ({ page }) => {
    await expect(page.getByText('Today', { exact: true })).toBeVisible()
  })

  // Test 26
  test('Delete button removes the hand from the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No hands yet.')).toBeVisible()
  })

  // Test 27
  test('Delete button does not navigate away from the history view', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Hand history' })).toBeVisible()
  })
})

test.describe('history with two hands', () => {
  test.beforeEach(async ({ page }) => {
    await clearFirestoreHands(await getTestUserUid())
    await page.goto('/')
    // First hand (older): BTN, A♥ K♠
    await recordMinimalHand(page)
    await page.getByRole('button', { name: '← History' }).click()
    // Second hand (newer): CO, A♠ K♠
    await page.getByRole('button', { name: '+ New hand' }).click()
    await page.getByRole('button', { name: 'No board' }).click()
    await page.getByRole('button', { name: 'CO' }).click()
    await page.getByRole('button', { name: 'A♠' }).click()
    await page.getByRole('button', { name: 'K♠' }).click()
    await page.getByRole('button', { name: /Done/ }).click()
    await page.getByRole('button', { name: 'H', exact: true }).click()
    await page.getByRole('button', { name: 'Call' }).click()
    await page.getByRole('button', { name: 'Save hand' }).click()
    await page.getByRole('button', { name: '← History' }).click()
  })

  // Test 25
  test('Hands are listed newest-first after recording two hands', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(2)
    const text = await page.textContent('body')
    expect(text!.indexOf('A♠ K♠')).toBeLessThan(text!.indexOf('A♥ K♠'))
  })
})
