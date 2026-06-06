import { useState } from 'react'
import { parseHand } from '../core/parser'
import type { HandAST } from '../core/types'

const PLACEHOLDER = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

interface Props {
  initialRaw?: string
  onSave: (raw: string, ast: HandAST) => void
  onCancel: () => void
}

export default function HandEditor({ initialRaw = '', onSave, onCancel }: Props) {
  const [raw, setRaw] = useState(initialRaw)

  let parsed: HandAST | null = null
  let parseError: string | null = null
  if (raw.trim()) {
    try {
      parsed = parseHand(raw)
    } catch (e) {
      parseError = (e as Error).message
    }
  }

  function handleSave() {
    if (parsed) onSave(raw, parsed)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
          {initialRaw ? 'Edit hand' : 'New hand'}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={!parsed} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={10}
        autoFocus
        spellCheck={false}
      />

      <div style={{ minHeight: '1.5rem', fontSize: '0.8rem' }}>
        {parseError && (
          <span style={{ color: 'var(--danger)' }}>⚠ {parseError}</span>
        )}
        {parsed && !parseError && (
          <span style={{ color: 'var(--success)' }}>✓ Valid hand</span>
        )}
        {!raw.trim() && (
          <span style={{ color: 'var(--text-muted)' }}>
            Format: <code>[Stakes: $x/$y]</code> · <code>Board: cards</code> · <code>Hero: POS cards</code> · streets
          </span>
        )}
      </div>
    </div>
  )
}
