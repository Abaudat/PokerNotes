import { useState } from 'react'
import type { ReactNode } from 'react'
import { nextSuggestions } from '../core/suggestions'
import { parseHand } from '../core/parser'
import { RANKS, SUITS, SUIT_GLYPHS } from '../core/cards'
import { buildRecordingView, applyChipEdit, usedCardsExcept } from '../core/recordingView'
import type { Chip } from '../core/recordingView'
import type { HandAST, StreetName } from '../core/types'
import { POSITION_COLORS, HERO_COLOR } from '../core/render'

const STREET_ORDER: StreetName[] = ['Preflop', 'Flop', 'Turn', 'River']
const SUIT_COLORS: Record<string, string> = { s: '#94a3b8', h: '#f87171', d: '#fb923c', c: '#4ade80' }
const VERB_LABELS: Record<string, string> = {
  x: 'Check', c: 'Call', r: 'Raise', f: 'Fold', b: 'Bet',
  a: 'All In', 'all in': 'All In',
}
const SHOWDOWN_VERB_LABELS: Record<string, string> = {
  shows: 'Shows', wins: 'Wins', loses: 'Loses',
}
const STAKES_PRESETS = ['1/2', '2/5', '5/5', '5/10', '10/20']

const HERO_POSITIONS = [
  'UTG', 'UTG+1', 'UTG+2', 'UTG+3',
  'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP',
]
const ALL_POSITIONS = [
  'H', 'V', 'V2', 'V3', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3',
  'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP',
]

interface Props {
  initialRaw?: string
  defaultStakes?: string
  onSave: (raw: string, ast: HandAST) => void
  onCancel: () => void
}

function actorColor(actor: string): string {
  if (actor === 'H') return HERO_COLOR
  return POSITION_COLORS[actor as Exclude<keyof typeof POSITION_COLORS, 'H'>] ?? '#6b7280'
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
    <div data-testid="card-picker" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(44px, 1fr))', gap: 3, maxWidth: 260 }}>
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

// ── ActiveEdit state ─────────────────────────────────────────────────────────
type EditStep = 'pick' | 'verb' | 'amount' | 'amount-opt'
interface ActiveEdit {
  chip: Chip
  rawSnapshot: string
  step: EditStep
  chosenVerb?: string
}

export default function HandEditor({ initialRaw, defaultStakes, onSave, onCancel }: Props) {
  const [raw, setRaw] = useState(initialRaw ?? '')
  const [history, setHistory] = useState<string[]>([])
  const [pendingCards, setPendingCards] = useState<string[]>([])
  const [amountInput, setAmountInput] = useState('')
  const [selectedStakes, setSelectedStakes] = useState<string | null>(defaultStakes ?? null)
  const [freeInput, setFreeInput] = useState('')
  const [showFree, setShowFree] = useState(false)
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null)

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
    setActiveEdit(null)
  }

  function handleSave() {
    try {
      const ast = parseHand(raw)
      onSave(raw, ast)
    } catch {
      // shouldn't happen if the wizard is followed
    }
  }

  function openEdit(chip: Chip) {
    setPendingCards([])
    setAmountInput('')
    setActiveEdit({
      chip,
      rawSnapshot: raw,
      step: chip.editKind === 'verb' ? 'verb' : 'pick',
    })
  }

  function cancelEdit() {
    setActiveEdit(null)
    setPendingCards([])
    setAmountInput('')
  }

  function applyEdit(newText: string) {
    if (!activeEdit || !activeEdit.chip.span) return
    if (raw !== activeEdit.rawSnapshot) { setActiveEdit(null); return }
    setHistory((h) => [...h, raw])
    setRaw(applyChipEdit(raw, activeEdit.chip.span, newText))
    setActiveEdit(null)
    setPendingCards([])
    setAmountInput('')
  }

  const { mode, options, context } = nextSuggestions(raw)

  // ── CHIP DISPLAY ──────────────────────────────────────────────────────────
  const chipLines = buildRecordingView(raw)

  function chipStyle(chip: Chip): React.CSSProperties {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.55rem',
      borderRadius: 6,
      fontSize: '0.85rem',
      fontWeight: 500,
      cursor: chip.editKind ? 'pointer' : 'default',
      border: '1px solid var(--border)',
      background: 'var(--surface2)',
      color: 'var(--text)',
      fontFamily: 'inherit',
      lineHeight: 1.3,
    }
    if (chip.kind === 'stakes') {
      return { ...base, color: 'var(--text-muted)', fontSize: '0.8rem' }
    }
    if (chip.kind === 'board-card') {
      const suitCode = chip.meta?.cardCode?.[1]
      return { ...base, color: suitCode ? SUIT_COLORS[suitCode] : 'var(--text)' }
    }
    if (chip.kind === 'hero-pos') {
      return { ...base, background: HERO_COLOR, color: '#000', border: 'none', fontWeight: 700 }
    }
    if (chip.kind === 'hero-card') {
      const suitCode = chip.meta?.cardCode?.[1]
      return { ...base, color: suitCode ? SUIT_COLORS[suitCode] : 'var(--text)', fontWeight: 600 }
    }
    if (chip.kind === 'action-actor' || chip.kind === 'showdown-actor') {
      const color = actorColor(chip.meta?.actor ?? '')
      return { ...base, color, fontWeight: chip.meta?.actor === 'H' ? 700 : 500 }
    }
    if (chip.kind === 'action-verb' || chip.kind === 'showdown-verb') {
      return { ...base, color: 'var(--text-muted)' }
    }
    if (chip.kind === 'showdown-card') {
      const suitCode = chip.meta?.cardCode?.[1]
      return { ...base, color: suitCode ? SUIT_COLORS[suitCode] : 'var(--text)' }
    }
    if (chip.kind === 'note') {
      return { ...base, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem', cursor: 'default' }
    }
    if (chip.kind === 'label') {
      return { ...base, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'default', padding: '0.2rem 0' }
    }
    return base
  }

  const recordedDisplay = chipLines.length > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {chipLines.map((line) => (
        <div key={line.key} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {line.chips.map((chip) => (
            chip.editKind ? (
              <button
                key={chip.id}
                data-chip-id={chip.id}
                onClick={() => openEdit(chip)}
                style={chipStyle(chip)}
              >
                {chip.text}
              </button>
            ) : (
              <span key={chip.id} style={chipStyle(chip)}>{chip.text}</span>
            )
          ))}
        </div>
      ))}
    </div>
  ) : null

  // ── EDIT OVERLAY ──────────────────────────────────────────────────────────
  let editContent: ReactNode = null
  if (activeEdit) {
    const { chip, step } = activeEdit

    const editHeader = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <StepLabel>Editing: {chip.text}</StepLabel>
        <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={cancelEdit} data-testid="cancel-edit">Cancel edit</button>
      </div>
    )

    if (step === 'pick') {
      if (chip.editKind === 'board-card' || chip.editKind === 'hero-card' || chip.editKind === 'showdown-card') {
        const usedCards = chip.span ? usedCardsExcept(raw, chip.span) : new Set<string>()
        editContent = (
          <div>
            {editHeader}
            <CardGrid
              usedCards={usedCards}
              selected={pendingCards}
              onToggle={(code) => {
                setPendingCards([code])
                applyEdit(code)
              }}
            />
          </div>
        )
      } else if (chip.editKind === 'hero-pos') {
        editContent = (
          <div>
            {editHeader}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {HERO_POSITIONS.map((pos) => (
                <button key={pos} className="btn-secondary" onClick={() => applyEdit(pos)}>{pos}</button>
              ))}
            </div>
          </div>
        )
      } else if (chip.editKind === 'actor') {
        editContent = (
          <div>
            {editHeader}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALL_POSITIONS.map((pos) => (
                <button key={pos} className="btn-secondary" onClick={() => applyEdit(pos)}>{pos}</button>
              ))}
            </div>
          </div>
        )
      } else if (chip.editKind === 'showdown-actor') {
        editContent = (
          <div>
            {editHeader}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALL_POSITIONS.map((pos) => (
                <button key={pos} className="btn-secondary" onClick={() => applyEdit(pos)}>{pos}</button>
              ))}
            </div>
          </div>
        )
      } else if (chip.editKind === 'showdown-verb') {
        editContent = (
          <div>
            {editHeader}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['shows', 'wins', 'loses'].map((v) => (
                <button key={v} className="btn-secondary" onClick={() => applyEdit(v)}>
                  {SHOWDOWN_VERB_LABELS[v] ?? v}
                </button>
              ))}
            </div>
          </div>
        )
      } else if (chip.editKind === 'stakes') {
        editContent = (
          <div>
            {editHeader}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {STAKES_PRESETS.map((s) => (
                <button key={s} className="btn-secondary" onClick={() => applyEdit(s)}>{s}</button>
              ))}
            </div>
          </div>
        )
      }
    } else if (step === 'verb') {
      const facingBet = chip.meta?.facingBet ?? false
      const verbOptions = facingBet ? ['c', 'r', 'f', 'all in'] : ['x', 'b', 'f', 'all in']
      editContent = (
        <div>
          {editHeader}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {verbOptions.map((v) => (
              <button
                key={v}
                className="btn-secondary"
                onClick={() => {
                  const verbInternal = v === 'all in' ? 'a' : v
                  if (verbInternal === 'r' || verbInternal === 'b') {
                    setActiveEdit({ ...activeEdit, step: 'amount', chosenVerb: v })
                  } else if (verbInternal === 'a') {
                    setActiveEdit({ ...activeEdit, step: 'amount-opt', chosenVerb: 'all in' })
                  } else {
                    // check/call/fold — no amount needed
                    applyEdit(v)
                  }
                }}
              >
                {VERB_LABELS[v] ?? v}
              </button>
            ))}
          </div>
        </div>
      )
    } else if (step === 'amount') {
      const amount = parseInt(amountInput, 10)
      const isValid = !isNaN(amount) && amount > 0
      const chosenVerb = activeEdit.chosenVerb ?? 'b'
      editContent = (
        <div>
          {editHeader}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>$</span>
            <input
              type="number"
              min={1}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && isValid) applyEdit(`${chosenVerb} ${amount}`) }}
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
            <button className="btn-primary" disabled={!isValid} onClick={() => applyEdit(`${chosenVerb} ${amount}`)}>OK</button>
          </div>
        </div>
      )
    } else if (step === 'amount-opt') {
      const amount = parseInt(amountInput, 10)
      const isValid = !isNaN(amount) && amount > 0
      editContent = (
        <div>
          {editHeader}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number"
              min={1}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && isValid) applyEdit(`all in ${amount}`) }}
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
            <button className="btn-primary" disabled={!isValid} onClick={() => applyEdit(`all in ${amount}`)}>OK</button>
            <button className="btn-secondary" onClick={() => applyEdit('all in')}>Skip</button>
          </div>
        </div>
      )
    }
  }

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

  // ── STEP CONTENT (wizard) ──────────────────────────────────────────────────
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

  // ── FREE-TEXT NOTE ─────────────────────────────────────────────────────────
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
          <button className="btn-primary" onClick={() => commitNote(freeInput)}>Add note</button>
          <button className="btn-secondary" onClick={() => { setShowFree(false); setFreeInput('') }}>Cancel</button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {header}
      {recordedDisplay}
      <div data-testid="step-content">
        <StepLabel>{stepLabel}</StepLabel>
        {activeEdit ? editContent : stepContent}
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
