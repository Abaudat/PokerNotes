import { test, expect } from '@playwright/test'

// Tests 1-3: unauthenticated context (storageState: undefined from auth project)

test('Unauthenticated user sees "PokerNotes" heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'PokerNotes' })).toBeVisible()
})

test('Unauthenticated user sees "Sign in with Google" button', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})

test('Unauthenticated user does not see the hand history header', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hand history' })).not.toBeVisible()
})

// Tests 4-6: authenticated context
test.describe('authenticated context', () => {
  test.use({ storageState: './e2e/.auth/user.json' })

  test('Authenticated user sees their email in the header', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('playwright@test.com')).toBeVisible()
  })

  test('Authenticated user sees hand count in the header', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/\d+ hands?/)).toBeVisible()
  })

  test('Clicking sign-out navigates to the sign-in page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  })
})
