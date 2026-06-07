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
import type { HandAST } from '../core/types'
import type { HandRepository, ListedHand } from '../data/repository'
import HandHistory from '../ui/HandHistory'
import HandEditor from '../ui/HandEditor'
import HandView from '../ui/HandView'

export interface SavedHand {
  id: string
  raw: string
  ast: HandAST
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

  useEffect(() => {
    if (!user) {
      setHands([])
      repoRef.current = null
      return
    }
    const db = getFirestore(getFirebaseApp())
    const repo = new FirestoreRepository(user.uid, db)
    repoRef.current = repo
    return repo.subscribe(setHands)
  }, [user?.uid])

  async function saveHand(raw: string, ast: HandAST) {
    if (!repoRef.current) return
    const id = await repoRef.current.save(raw)
    setView({ kind: 'view', hand: { id, raw, ast, savedAt: new Date() } })
  }

  async function updateHand(id: string, raw: string, _ast: HandAST) {
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
    const ast = parseHand(stored.raw)
    setView({ kind: 'view', hand: { id: stored.id, raw: stored.raw, ast, savedAt: stored.createdAt } })
  }

  if (user === undefined) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--accent)' }}>PokerNotes</h1>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: '1.5rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '1rem' }}>
          PokerNotes
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Sign in to record and sync your hands across devices.
        </p>
        <button
          className="btn-primary"
          style={{ fontSize: '1rem', padding: '0.6rem 1.4rem' }}
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1
          style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
          onClick={() => setView({ kind: 'history' })}
        >
          PokerNotes
        </h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {hands.length} hand{hands.length !== 1 ? 's' : ''}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {user.displayName ?? user.email}
          </span>
          <button
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            onClick={() => signOut(getAuth(getFirebaseApp()))}
          >
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
              ? (raw, ast) => updateHand(view.handId!, raw, ast)
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
