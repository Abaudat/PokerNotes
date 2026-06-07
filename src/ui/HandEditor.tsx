import { useState } from 'react'
import type { ReactNode } from 'react'
import { nextSuggestions } from '../core/suggestions'
import { parseHand } from '../core/parser'
import { RANKS, SUITS, SUIT_GLYPHS } from '../core/cards'
import type { HandAST, StreetName } from '../core/types'

const STREET_ORDER: StreetName[] = ['Preflop', 'Flop', 'Turn', 'River']
const SUIT_COLORS: Record<string, string> = { s: '#94a3b8', h: '#f87171', d: '#fb923c', c: '#4ade80' }
const VERB_LABELS: Record<string, string> = {
  x: 'Check', c: 'Call', r: 'Raise', f: 'Fold', b: 'Bet',
  a: 'All In', 'all in': 'All In',
}
const SHOWDOWN_VERB_LABELS: Record<string, string> = {
  shows: 'Shows', wins: 'Wins', loses: 'Loses',
}
const STAKES_PRESETS = ['$1/$2', '$2/$5', '$5/$10', '$10/$20']

interface Props {
  initialRaw?: string
  defaultStakes?: string
  onSave: (raw: string, ast: HandAST) => void
  onCancel: () => void
}

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
      {SUITS.map((suit) => (
        <div key={suit} style={{ textAlign: 'center', color: SUIT_COLORS[suit], fontWeight: 700, fontSize: '0.9rem', paddingBottom: 2 }}>
          {SUIT_GLYPHS[suit]}
        </div>
      ))}
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

export default function HandEditor({ initialRaw, defaultStakes, onSave, onCancel }: Props) {
  const [raw, setRaw] = useState(initialRaw ?? '')
  const [history, setHistory] = useState<string[]>([])
  const [pendingCards, setPendingCards] = useState<string[]>([])
  const [amountInput, setAmountInput] = useState('')
  const [selectedStakes, setSelectedStakes] = useState<string | null>(defaultStakes ?? null)
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

  // Inserts a # comment BEFORE the last structured line so the current
  // wizard position (street header, hero line, etc.) stays at the end of raw
  // and subsequent suggestion-driven commits continue correctly.
  function commitNote(note: string) {
    if (!note.trim()) return
    setHistory((h) => [...h, raw])
    setRaw((currentRaw) => {
      const idx = currentRaw.lastIndexOf('\n')
      const beforeLast = idx >= 0 ? currentRaw.slice(0, idx + 1) : ''
      const lastLine = idx >= 0 ? currentRaw.slice(idx + 1) : currentRaw
      return beforeLast + '# ' + note.trim() + '\n' + lastLine
    })
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

  // ── RAW SUMMARY ────────────────────────────────────────────────────────────
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

  // ── STEP CONTENT ───────────────────────────────────────────────────────────
  let stepLabel = ''
  let stepContent: ReactNode = null

  if (mode === 'AWAIT_BOARD') {
    const validCount = pendingCards.length === 0 || (pendingCards.length >= 3 && pendingCards.length <= 5)
    const stakesPrefix = selectedStakes ? `[Stakes: ${selectedStakes}]\n` : ''
    stepLabel = `Board cards${pendingCards.length > 0 ? ` — ${pendingCards.length} selected` : ''}`
    stepContent = (
      <>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stakes</span>
          {STAKES_PRESETS.map((s) => (
            <button
              key={s}
              className={selectedStakes === s ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
              onClick={() => setSelectedStakes((prev) => (prev === s ? null : s))}
            >
              {s}
            </button>
          ))}
          {selectedStakes && (
            <button
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
              onClick={() => setSelectedStakes(null)}
            >
              None
            </button>
          )}
        </div>
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
            <button className="btn-secondary" onClick={() => commit(stakesPrefix + 'Board:\nHero: ')}>No board</button>
          )}
          {pendingCards.length > 0 && (
            <button className="btn-primary" disabled={!validCount} onClick={() => commit(stakesPrefix + 'Board: ' + pendingCards.join(' ') + '\nHero: ')}>
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
          <button key={pos} className="btn-secondary" onClick={() => commit(pos + ' ')}>
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
            onClick={() => commit(pendingCards.join('') + '\nPreflop: ')}
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
      if (raw.endsWith(': ') || raw.endsWith(', ')) return actor
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
        {(canAdvance || context?.canShowdown || canSave) && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {canAdvance && nextSt && (
              <button className="btn-secondary" onClick={() => commit('\n' + nextSt + ': ')}>
                → {nextSt}
              </button>
            )}
            {context?.canShowdown && (
              <button className="btn-secondary" onClick={() => commit('\nShowdown: ')}>
                → Showdown
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
  } else if (mode === 'AWAIT_AMOUNT_OPT') {
    const amount = parseInt(amountInput, 10)
    const isValid = !isNaN(amount) && amount > 0
    stepLabel = 'Effective amount (optional)'
    stepContent = (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
        <button className="btn-secondary" onClick={() => commit(', ')}>Skip</button>
      </div>
    )
  } else if (mode === 'AWAIT_SHOWDOWN_ACTOR') {
    const canSave = context?.canSave

    const showdownActorText = (actor: string): string => {
      if (raw.endsWith(': ') || raw.endsWith(', ')) return actor
      return ', ' + actor
    }

    stepLabel = 'Showdown'
    stepContent = (
      <>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {options.map((actor) => (
            <button key={actor} className="btn-secondary" onClick={() => commit(showdownActorText(actor))}>
              {actor}
            </button>
          ))}
        </div>
        {canSave && (
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn-primary" onClick={handleSave}>Save hand</button>
          </div>
        )}
      </>
    )
  } else if (mode === 'AWAIT_SHOWDOWN_VERB') {
    stepLabel = 'Showdown action'
    stepContent = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {options.map((verb) => (
          <button key={verb} className="btn-secondary" onClick={() => commit(' ' + verb)}>
            {SHOWDOWN_VERB_LABELS[verb] ?? verb}
          </button>
        ))}
      </div>
    )
  } else if (mode === 'AWAIT_SHOWDOWN_CARDS') {
    const allCodes = RANKS.flatMap((r) => SUITS.map((s) => r + s))
    const availableSet = new Set(options)
    const usedCards = new Set(allCodes.filter((c) => !availableSet.has(c)))
    const isValid = pendingCards.length === 2
    stepLabel = 'Shown cards'
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
            onClick={() => commit(' ' + pendingCards.join(''))}
          >
            {isValid ? `Done — ${pendingCards.join(' ')}` : 'Pick 2 cards'}
          </button>
        </div>
      </>
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
            placeholder="note to add…"
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
          <button
            className="btn-primary"
            onClick={() => commitNote(freeInput)}
          >
            Add note
          </button>
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
