import { useState } from 'react'
import type { ReactNode } from 'react'
import { nextSuggestions } from '../core/suggestions'
import { parseHand } from '../core/parser'
import { RANKS, SUITS, SUIT_GLYPHS } from '../core/cards'
import type { HandAST, StreetName } from '../core/types'

const STREET_ORDER: StreetName[] = ['Preflop', 'Flop', 'Turn', 'River']
const SUIT_COLORS: Record<string, string> = { s: '#94a3b8', h: '#f87171', d: '#fb923c', c: '#4ade80' }
const VERB_LABELS: Record<string, string> = { x: 'Check', c: 'Call', r: 'Raise', f: 'Fold', b: 'Bet' }
const STAKES_PRESETS = ['$1/$2', '$2/$5', '$5/$10', '$10/$20']

interface Props {
  initialRaw?: string
  onSave: (raw: string, ast: HandAST) => void
  onCancel: () => void
}

// 4-column grid: suits as columns, ranks as rows (A→2)
function CardGrid({
  usedCards,
  selected,
  onToggle,
}: {
  usedCards: Set<string>
  selected: string[]
  onToggle: (code: string) => void
}) {
  const sel = new Set(selected)
  const reversedRanks = [...RANKS].reverse()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(44px, 1fr))', gap: 3, maxWidth: 260 }}>
      {/* Suit header row */}
      {SUITS.map((suit) => (
        <div key={suit} style={{ textAlign: 'center', color: SUIT_COLORS[suit], fontWeight: 700, fontSize: '0.9rem', paddingBottom: 2 }}>
          {SUIT_GLYPHS[suit]}
        </div>
      ))}
      {/* Card buttons — flatMap produces a flat child array; each cell has a unique key */}
      {reversedRanks.flatMap((rank) =>
        SUITS.map((suit) => {
          const code = rank + suit
          const used = usedCards.has(code)
          const active = sel.has(code)
          return (
            <button
              key={code}
              onClick={() => { if (!used) onToggle(code) }}
              disabled={used}
              style={{
                padding: '0.25rem 0',
                fontSize: '0.72rem',
                lineHeight: 1.2,
                background: active ? 'var(--accent)' : 'var(--surface2)',
                color: active ? '#000' : 'var(--text)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 4,
                opacity: used ? 0.2 : 1,
                cursor: used ? 'default' : 'pointer',
                fontWeight: active ? 700 : 400,
              }}
            >
              <span style={{ color: active ? '#000' : 'var(--text)' }}>{rank}</span>
              <span style={{ color: active ? '#000' : SUIT_COLORS[suit] }}>{SUIT_GLYPHS[suit]}</span>
            </button>
          )
        })
      )}
    </div>
  )
}

export default function HandEditor({ initialRaw, onSave, onCancel }: Props) {
  const [raw, setRaw] = useState(initialRaw ?? '')
  const [history, setHistory] = useState<string[]>([])
  const [pendingCards, setPendingCards] = useState<string[]>([])
  const [amountInput, setAmountInput] = useState('')
  const [stakesChosen, setStakesChosen] = useState(initialRaw !== undefined)
  const [freeInput, setFreeInput] = useState('')
  const [showFree, setShowFree] = useState(false)

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (initialRaw !== undefined) {
    let parsed: HandAST | null = null
    let parseError: string | null = null
    if (raw.trim()) {
      try { parsed = parseHand(raw) }
      catch (e) { parseError = (e as Error).message }
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Edit hand</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn-primary" disabled={!parsed} onClick={() => parsed && onSave(raw, parsed)}>Save</button>
          </div>
        </div>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} autoFocus spellCheck={false} />
        <div style={{ minHeight: '1.5rem', fontSize: '0.8rem' }}>
          {parseError && <span style={{ color: 'var(--danger)' }}>⚠ {parseError}</span>}
          {parsed && <span style={{ color: 'var(--success)' }}>✓ Valid hand</span>}
        </div>
      </div>
    )
  }

  // ── RECORDING MODE helpers ─────────────────────────────────────────────────
  function commit(text: string) {
    setHistory((h) => [...h, raw])
    setRaw((r) => r + text)
    setPendingCards([])
    setAmountInput('')
    setShowFree(false)
    setFreeInput('')
  }

  function undo() {
    if (history.length === 0) return
    setRaw(history[history.length - 1])
    setHistory((h) => h.slice(0, -1))
    setPendingCards([])
    setAmountInput('')
  }

  function handleSave() {
    try {
      const ast = parseHand(raw)
      onSave(raw, ast)
    } catch {
      // shouldn't happen if the wizard is followed
    }
  }

  const { mode, options, context } = nextSuggestions(raw)

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>New hand</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {history.length > 0 && (
          <button className="btn-secondary" onClick={undo}>← Undo</button>
        )}
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )

  // ── RAW SUMMARY (editable — lets user fix anything mid-recording) ──────────
  const summary = raw.trim() ? (
    <textarea
      value={raw}
      rows={5}
      spellCheck={false}
      onChange={(e) => {
        setRaw(e.target.value)
        setPendingCards([])
        setAmountInput('')
      }}
      style={{ fontSize: '0.75rem', color: 'var(--text-muted)', resize: 'vertical' }}
    />
  ) : null

  // ── STAKES STEP ────────────────────────────────────────────────────────────
  if (!stakesChosen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {header}
        <StepLabel>Stakes (optional)</StepLabel>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {STAKES_PRESETS.map((s) => (
            <button key={s} className="btn-secondary" onClick={() => { commit(`Stakes: ${s}\n`); setStakesChosen(true) }}>
              {s}
            </button>
          ))}
          <button className="btn-secondary" onClick={() => setStakesChosen(true)}>Skip</button>
        </div>
      </div>
    )
  }

  // ── STEP CONTENT ───────────────────────────────────────────────────────────
  let stepLabel = ''
  let stepContent: ReactNode = null

  if (mode === 'AWAIT_BOARD') {
    const validCount = pendingCards.length === 0 || (pendingCards.length >= 3 && pendingCards.length <= 5)
    stepLabel = `Board cards${pendingCards.length > 0 ? ` — ${pendingCards.length} selected` : ''}`
    stepContent = (
      <>
        <CardGrid
          usedCards={new Set()}
          selected={pendingCards}
          onToggle={(code) =>
            setPendingCards((p) => {
              if (p.includes(code)) return p.filter((c) => c !== code)
              if (p.length >= 5) return p
              return [...p, code]
            })
          }
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
          {pendingCards.length === 0 && (
            <button className="btn-secondary" onClick={() => commit('Board:\n')}>No board</button>
          )}
          {pendingCards.length > 0 && (
            <button className="btn-primary" disabled={!validCount} onClick={() => commit('Board: ' + pendingCards.join(' ') + '\n')}>
              Done ({pendingCards.length})
            </button>
          )}
          {pendingCards.length > 0 && pendingCards.length < 3 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>need {3 - pendingCards.length} more</span>
          )}
        </div>
      </>
    )
  } else if (mode === 'AWAIT_HERO_POS') {
    stepLabel = 'Hero position'
    stepContent = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {options.map((pos) => (
          <button key={pos} className="btn-secondary" onClick={() => commit('Hero: ' + pos)}>
            {pos}
          </button>
        ))}
      </div>
    )
  } else if (mode === 'AWAIT_HERO_CARDS') {
    const allCodes = RANKS.flatMap((r) => SUITS.map((s) => r + s))
    const availableSet = new Set(options)
    const usedCards = new Set(allCodes.filter((c) => !availableSet.has(c)))
    const isValid = pendingCards.length === 2
    stepLabel = `Hero hole cards — ${pendingCards.length}/2`
    stepContent = (
      <>
        <CardGrid
          usedCards={usedCards}
          selected={pendingCards}
          onToggle={(code) =>
            setPendingCards((p) => {
              if (p.includes(code)) return p.filter((c) => c !== code)
              if (p.length >= 2) return p
              return [...p, code]
            })
          }
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button
            className="btn-primary"
            disabled={!isValid}
            onClick={() => commit(' ' + pendingCards.join(' ') + '\n')}
          >
            {isValid ? `Done — ${pendingCards.join(' ')}` : 'Pick 2 cards'}
          </button>
        </div>
      </>
    )
  } else if (mode === 'AWAIT_ACTOR') {
    const currentStreet = context?.street
    const canAdvance = context?.canAdvance
    const canSave = context?.canSave

    const actorText = (actor: string): string => {
      if (!raw || raw.endsWith('\n')) return (currentStreet ?? 'Preflop') + ': ' + actor
      if (raw.endsWith(': ')) return actor
      return ', ' + actor
    }

    const nextSt: StreetName | undefined = (() => {
      if (!currentStreet) return undefined
      const idx = STREET_ORDER.indexOf(currentStreet)
      return idx >= 0 && idx < STREET_ORDER.length - 1 ? STREET_ORDER[idx + 1] : undefined
    })()

    stepLabel = currentStreet ?? 'Next actor'
    stepContent = (
      <>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {options.map((actor) => (
            <button key={actor} className="btn-secondary" onClick={() => commit(actorText(actor))}>
              {actor}
            </button>
          ))}
        </div>
        {(canAdvance || canSave) && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {canAdvance && nextSt && (
              <button className="btn-secondary" onClick={() => commit('\n' + nextSt + ': ')}>
                → {nextSt}
              </button>
            )}
            {canSave && (
              <button className="btn-primary" onClick={handleSave}>Save hand</button>
            )}
          </div>
        )}
      </>
    )
  } else if (mode === 'AWAIT_VERB') {
    stepLabel = 'Action'
    stepContent = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {options.map((verb) => (
          <button key={verb} className="btn-secondary" onClick={() => commit(' ' + verb)}>
            {VERB_LABELS[verb] ?? verb}
          </button>
        ))}
      </div>
    )
  } else if (mode === 'AWAIT_AMOUNT') {
    const amount = parseInt(amountInput, 10)
    const isValid = !isNaN(amount) && amount > 0
    stepLabel = 'Amount'
    stepContent = (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>$</span>
        <input
          type="number"
          min={1}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && isValid) commit(' ' + amount) }}
          autoFocus
          placeholder="0"
          style={{
            width: 100,
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button className="btn-primary" disabled={!isValid} onClick={() => commit(' ' + amount)}>OK</button>
      </div>
    )
  }

  // ── FREE-TEXT ESCAPE HATCH ─────────────────────────────────────────────────
  const freeSection = (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      {!showFree ? (
        <button
          className="btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
          onClick={() => setShowFree(true)}
        >
          ··· type manually
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={freeInput}
            onChange={(e) => setFreeInput(e.target.value)}
            autoFocus
            placeholder="raw text to append…"
            style={{
              flex: 1,
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button className="btn-primary" onClick={() => { if (freeInput) commit(freeInput) }}>Append</button>
          <button className="btn-secondary" onClick={() => { setShowFree(false); setFreeInput('') }}>Cancel</button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {header}
      {summary}
      <div>
        <StepLabel>{stepLabel}</StepLabel>
        {stepContent}
      </div>
      {freeSection}
    </div>
  )
}

function StepLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </div>
  )
}
