import type { Page } from '@playwright/test'

const FIRESTORE_EMULATOR = 'http://localhost:8080'
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'pokernotes-70a94'

export async function clearFirestoreHands(_uid: string): Promise<void> {
  // Use the emulator admin endpoint — bypasses security rules, clears all documents
  await fetch(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  )
}

export async function getTestUserUid(): Promise<string> {
  const res = await fetch(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'playwright@test.com',
        password: 'test1234',
        returnSecureToken: true,
      }),
    }
  )
  const { localId } = await res.json()
  return localId
}

/**
 * Records a minimal hand: no stakes, no board, BTN position, A♥ K♠, Hero checks preflop.
 * Ends on the hand detail view (← History button visible).
 */
export async function recordMinimalHand(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await page.waitForSelector('button:has-text("← History")')
}

/**
 * Records a hand with 1/2 stakes: no board, BTN position, A♥ K♠, Hero checks preflop.
 * Ends on the hand detail view.
 */
export async function recordHandWithStakes(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: 'No board' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♠' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await page.waitForSelector('button:has-text("← History")')
}

/**
 * Records a rich hand: 1/2 stakes, board 2♠ 3♠ 4♠, BTN position, A♥ K♥, Hero raises $20 preflop.
 * Ends on the hand detail view.
 */
export async function recordRichHand(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: '1/2' }).click()
  await page.getByRole('button', { name: '2♠' }).click()
  await page.getByRole('button', { name: '3♠' }).click()
  await page.getByRole('button', { name: '4♠' }).click()
  await page.getByRole('button', { name: 'Done (3)' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'A♥' }).click()
  await page.getByRole('button', { name: 'K♥' }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'H', exact: true }).click()
  await page.getByRole('button', { name: 'Bet' }).click()
  await page.locator('input[type="number"]').fill('20')
  await page.getByRole('button', { name: 'OK' }).click()
  await page.getByRole('button', { name: 'Save hand' }).click()
  await page.waitForSelector('button:has-text("← History")')
}
