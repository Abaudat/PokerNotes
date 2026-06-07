import type { Page } from '@playwright/test'

const FIRESTORE_EMULATOR = 'http://localhost:8080'
const PROJECT_ID = 'pokernotes-70a94'

/**
 * Taps through the wizard to save a minimal hand:
 * skip stakes → BTN position → A♥ K♠ hole cards → save
 * Returns after the hand detail view is visible.
 */
export async function recordMinimalHand(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New hand' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'BTN' }).click()
  await page.getByRole('button', { name: 'Ah' }).click()
  await page.getByRole('button', { name: 'Ks' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForSelector('button:has-text("Back")')
}

/**
 * Deletes all hands for the authenticated test user via the Firestore Emulator REST API.
 * Call in beforeEach to ensure a clean slate.
 */
export async function clearFirestoreHands(uid: string): Promise<void> {
  const listUrl = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/hands`
  const listRes = await fetch(listUrl)
  if (!listRes.ok) return
  const data = await listRes.json()
  const docs: { name: string }[] = data.documents ?? []
  await Promise.all(
    docs.map(doc =>
      fetch(`${FIRESTORE_EMULATOR}/v1/${doc.name}`, { method: 'DELETE' })
    )
  )
}

/** Reads the test user's UID from the Auth emulator. */
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
