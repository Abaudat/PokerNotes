import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  expect: {
    timeout: 3000,
  },
  use: {
    baseURL: 'http://localhost:5174/PokerNotes/',
    storageState: './e2e/.auth/user.json',
    trace: 'on-first-retry',
    actionTimeout: 3000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/auth.spec.ts'],
    },
    {
      name: 'auth',
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
      testMatch: ['**/auth.spec.ts'],
    },
  ],
  webServer: {
    command: 'cross-env VITE_USE_EMULATOR=true npx vite --port 5174',
    url: 'http://localhost:5174/PokerNotes/',
    reuseExistingServer: false,
    timeout: 30000,
  },
})
