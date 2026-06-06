import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

vi.mock('../data/firebase', () => ({
  getFirebaseApp: vi.fn().mockReturnValue({}),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({}),
  onAuthStateChanged: vi.fn((_auth, callback: (u: null) => void) => {
    callback(null)
    return () => {}
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({}),
}))

test('renders sign-in page when unauthenticated', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /pokernotes/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
})
