import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import type { FirebaseApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let emulatorsConnected = false

export function getFirebaseApp(): FirebaseApp {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  if (import.meta.env.VITE_USE_EMULATOR === 'true' && !emulatorsConnected) {
    emulatorsConnected = true
    connectAuthEmulator(getAuth(app), 'http://localhost:9099', { disableWarnings: true })
    connectFirestoreEmulator(getFirestore(app), 'localhost', 8080)
  }
  return app
}
