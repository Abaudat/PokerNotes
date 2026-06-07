import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json')
const TEST_EMAIL = 'playwright@test.com'
const TEST_PASSWORD = 'test1234'
const AUTH_EMULATOR = 'http://localhost:9099'

async function createTestUser() {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, returnSecureToken: true }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    // EMAIL_EXISTS is fine — user already created in a previous run
    if (!body.includes('EMAIL_EXISTS')) {
      throw new Error(`Failed to create test user: ${body}`)
    }
  }
}

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  await createTestUser()

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:5174/PokerNotes/')

  // Wait for the app to load and the test seam to be available
  await page.waitForFunction(
    () => typeof (window as any).__signInForTest === 'function',
    undefined,
    { timeout: 10000 }
  )

  await page.evaluate(
    async ({ email, password }: { email: string; password: string }) => {
      await (window as any).__signInForTest(email, password)
    },
    { email: TEST_EMAIL, password: TEST_PASSWORD }
  )

  // Wait until the authenticated UI is visible (history header)
  await page.waitForSelector('h2', { timeout: 10000 })
  // Wait for Firebase to write the auth token to localStorage (browserLocalPersistence)
  await page.waitForFunction(
    () => Object.keys(window.localStorage).some(k => k.startsWith('firebase:authUser:')),
    undefined,
    { timeout: 5000 }
  )

  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}
