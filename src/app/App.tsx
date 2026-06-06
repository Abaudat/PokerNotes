import { useState } from 'react'
import type { HandAST } from '../core/types'
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

export default function App() {
  const [hands, setHands] = useState<SavedHand[]>([])
  const [view, setView] = useState<View>({ kind: 'history' })

  function saveHand(raw: string, ast: HandAST) {
    const saved: SavedHand = { id: ast.id, raw, ast, savedAt: new Date() }
    setHands((prev) => [saved, ...prev])
    setView({ kind: 'view', hand: saved })
  }

  function updateHand(id: string, raw: string, ast: HandAST) {
    setHands((prev) => prev.map((h) => h.id === id ? { ...h, raw, ast } : h))
    setView({ kind: 'history' })
  }

  function deleteHand(id: string) {
    setHands((prev) => prev.filter((h) => h.id !== id))
    if (view.kind === 'view' && view.hand.id === id) {
      setView({ kind: 'history' })
    }
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
      </header>

      {view.kind === 'history' && (
        <HandHistory
          hands={hands}
          onNew={() => setView({ kind: 'editor' })}
          onView={(hand) => setView({ kind: 'view', hand })}
          onDelete={deleteHand}
        />
      )}

      {view.kind === 'editor' && (
        <HandEditor
          initialRaw={view.initialRaw}
          onSave={view.handId
            ? (raw, ast) => updateHand(view.handId!, raw, ast)
            : saveHand}
          onCancel={() => setView({ kind: 'history' })}
        />
      )}

      {view.kind === 'view' && (
        <HandView
          hand={view.hand}
          onBack={() => setView({ kind: 'history' })}
          onEdit={() => setView({ kind: 'editor', initialRaw: view.hand.raw, handId: view.hand.id })}
        />
      )}
    </div>
  )
}
