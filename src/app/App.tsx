import { useState, useEffect, useRef } from 'react'
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  signOut,
  GoogleAuthProvider,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { getFirebaseApp } from '../data/firebase'
import { FirestoreRepository } from '../data/firestoreRepository'
import { parseHand } from '../core/parser'
import type { HandState } from '../core/types'
import type { HandRepository, ListedHand } from '../data/repository'
import HandHistory from '../ui/HandHistory'
import HandEditor from '../ui/HandEditor'
import HandView from '../ui/HandView'

export interface SavedHand {
  id: string
  raw: string
  state: HandState
  savedAt: Date
}

type View =
  | { kind: 'history' }
  | { kind: 'editor'; initialRaw?: string; handId?: string }
  | { kind: 'view'; hand: SavedHand }

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  ;(window as unknown as Record<string, unknown>).__signInForTest = async (email: string, password: string) => {
    const auth = getAuth(getFirebaseApp())
    await setPersistence(auth, browserLocalPersistence)
    await signInWithEmailAndPassword(auth, email, password)
  }
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [hands, setHands] = useState<ListedHand[]>([])
  const [view, setView] = useState<View>({ kind: 'history' })
  const repoRef = useRef<HandRepository | null>(null)

  useEffect(() => {
    const auth = getAuth(getFirebaseApp())
    return onAuthStateChanged(auth, setUser)
  }, [])

  const uid = user?.uid
  useEffect(() => {
    if (!uid) {
      setHands([])
      repoRef.current = null
      return
    }
    const db = getFirestore(getFirebaseApp())
    const repo = new FirestoreRepository(uid, db)
    repoRef.current = repo
    return repo.subscribe(setHands)
  }, [uid])

  async function saveHand(raw: string, state: HandState) {
    if (!repoRef.current) return
    const id = await repoRef.current.save(raw)
    setView({ kind: 'view', hand: { id, raw, state, savedAt: new Date() } })
  }

  async function updateHand(id: string, raw: string) {
    if (!repoRef.current) return
    await repoRef.current.update(id, raw)
    setView({ kind: 'history' })
  }

  async function deleteHand(id: string) {
    if (!repoRef.current) return
    await repoRef.current.delete(id)
    if (view.kind === 'view' && view.hand.id === id) setView({ kind: 'history' })
  }

  async function openHand(id: string) {
    if (!repoRef.current) return
    const stored = await repoRef.current.get(id)
    if (!stored) return
    const state = parseHand(stored.raw)
    setView({ kind: 'view', hand: { id: stored.id, raw: stored.raw, state, savedAt: stored.createdAt } })
  }

  if (user === undefined) {
    return (
      <div className="app-shell" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <h1 className="brand-large">PokerNotes</h1>
        <p className="muted" style={{ marginTop: '0.75rem' }}>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell" style={{ maxWidth: 480, textAlign: 'center', paddingTop: '5rem' }}>
        <h1 className="brand-large">PokerNotes</h1>
        <p className="muted" style={{ margin: '1.25rem 0 2.25rem', fontSize: '0.95rem' }}>
          Sign in to record and sync your hands across devices.
        </p>
        <button
          className="btn-primary"
          style={{ fontSize: '1rem', padding: '0.6rem 1.6rem' }}
          onClick={() => {
            const auth = getAuth(getFirebaseApp())
            signInWithPopup(auth, new GoogleAuthProvider())
          }}
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="brand" onClick={() => setView({ kind: 'history' })}>
          PokerNotes
        </h1>
        <span className="header-count">
          {hands.length} hand{hands.length !== 1 ? 's' : ''}
        </span>
        <span className="header-user">
          <span className="header-email">{user.displayName ?? user.email}</span>
          <button className="btn-ghost" onClick={() => signOut(getAuth(getFirebaseApp()))}>
            Sign out
          </button>
        </span>
      </header>

      {view.kind === 'history' && (
        <HandHistory
          hands={hands}
          onNew={() => setView({ kind: 'editor' })}
          onView={openHand}
          onDelete={deleteHand}
        />
      )}

      {view.kind === 'editor' && (
        <HandEditor
          initialRaw={view.initialRaw}
          defaultStakes={view.handId ? undefined : hands[0]?.summary.stakes}
          onSave={
            view.handId
              ? (raw) => updateHand(view.handId!, raw)
              : saveHand
          }
          onCancel={() => setView({ kind: 'history' })}
        />
      )}

      {view.kind === 'view' && (
        <HandView
          hand={view.hand}
          onBack={() => setView({ kind: 'history' })}
          onEdit={() =>
            setView({ kind: 'editor', initialRaw: view.hand.raw, handId: view.hand.id })
          }
        />
      )}
    </div>
  )
}
