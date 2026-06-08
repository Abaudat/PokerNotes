import { useState } from 'react'
import type { ReactNode } from 'react'
import { parseHand } from '../core/parser'
import { serializeHand } from '../core/serializer'
import { RANKS, SUITS, SUIT_GLYPHS, parseCard } from '../core/cards'
import {
  nextStep,
  isComplete,
  usedCards,
  nextStreetName,
  legalActorsForActionSlot,
  legalVerbsForActionSlot,
  legalShowdownActorsForSlot,
  HERO_POSITIONS,
  createBlank,
  setStakes,
  setBoard,
  setHeroPosition,
  setHeroCards,
  beginAction,
  setVerb,
  advanceToStreet,
  beginShowdown,
  beginShowdownActor,
  setShowdownVerb,
  setShowdownCards,
  addNote,
  editNote,
  editBoardCard,
  addBoardCard,
  editHeroPosition,
  editHeroCard,
  editActor,
  editShowdownActor,
  editShowdownVerb,
  editShowdownCard,
} from '../core/engine'
import { buildEditorView, POSITION_COLORS, HERO_COLOR } from '../core/render'
import type { Chip } from '../core/render'
import type { HandState, Verb, Card, ShowdownVerb, StreetName } from '../core/types'

const SUIT_COLORS: Record<string, string> = { s: '#94a3b8', h: '#f87171', d: '#fb923c', c: '#4ade80' }
const VERB_LABELS: Record<Verb, string> = {
  x: 'Check', c: 'Call', r: 'Raise', f: 'Fold', b: 'Bet', a: 'All In',
}
const SHOWDOWN_VERBS: ShowdownVerb[] = ['shows', 'wins', 'loses']
const SHOWDOWN_VERB_LABELS: Record<ShowdownVerb, string> = {
  shows: 'Shows', wins: 'Wins', loses: 'Loses',
}
const STAKES_PRESETS = ['1/2', '2/5', '5/5', '5/10', '10/20']

interface Props {
  initialRaw?: string
  defaultStakes?: string
  onSave: (raw: string, state: HandState) => void
  onCancel: () => void
}

function toCard(code: string): Card {
  return parseCard(code)!
}

function actorColor(actor: string): string {
  if (actor === 'H') return HERO_COLOR
  return POSITION_COLORS[actor as Exclude<keyof typeof POSITION_COLORS, 'H'>] ?? '#6b7280'
}

function CardGrid({
  usedCards: used,
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
          const isUsed = used.has(code)
          const active = sel.has(code)
          return (
            <button
              key={code}
              onClick={() => { if (!isUsed) onToggle(code) }}
              disabled={isUsed}
              style={{
                padding: '0.25rem 0',
                fontSize: '0.72rem',
                lineHeight: 1.2,
                background: active ? 'var(--accent)' : 'var(--surface2)',
                color: active ? '#000' : 'var(--text)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 4,
                opacity: isUsed ? 0.2 : 1,
                cursor: isUsed ? 'default' : 'pointer',
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

// ── Poker chip components ────────────────────────────────────────────────────
const CHIP_COLORS: Record<number, { fill: string; text: string }> = {
  1:   { fill: '#94a3b8', text: '#0f172a' },
  5:   { fill: '#ef4444', text: '#fff'    },
  25:  { fill: '#22c55e', text: '#fff'    },
  100: { fill: '#1e293b', text: '#e2e8f0' },
}
const CHIP_DENOMS = [1, 5, 25, 100] as const

function PokerChip({ denom }: { denom: number }) {
  const { fill, text } = CHIP_COLORS[denom] ?? CHIP_COLORS[1]
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-label={`$${denom}`}>
      <circle cx="26" cy="27" r="22" fill="rgba(0,0,0,0.25)" />
      <circle cx="26" cy="26" r="22" fill={fill} />
      <circle cx="26" cy="26" r="18.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="6" strokeDasharray="8 6.9" />
      <circle cx="26" cy="26" r="13" fill={fill} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <text x="26" y="26" textAnchor="middle" dominantBaseline="central" fill={text} fontSize={denom >= 100 ? '9' : '10'} fontWeight="700" fontFamily="system-ui, sans-serif">{denom}</text>
    </svg>
  )
}

function ChipAmountInput({
  amountInput,
  onAmountChange,
  onSubmit,
  onSkip,
}: {
  amountInput: string
  onAmountChange: (v: string) => void
  onSubmit: (amount: number) => void
  onSkip?: () => void
}) {
  const amount = parseInt(amountInput, 10)
  const isValid = !isNaN(amount) && amount > 0

  const addChip = (denom: number) => {
    const current = isNaN(amount) ? 0 : amount
    onAmountChange(String(current + denom))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {CHIP_DENOMS.map((d) => (
          <button key={d} onClick={() => addChip(d)} title={`+$${d}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: '50%', lineHeight: 0 }}>
            <PokerChip denom={d} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>$</span>
        <input
          type="number"
          min={1}
          value={amountInput}
          onChange={(e) => onAmountChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && isValid) onSubmit(amount) }}
          placeholder="0"
          style={{
            width: 80,
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
        <button className="btn-primary" disabled={!isValid} onClick={() => isValid && onSubmit(amount)}>OK</button>
        {onSkip && <button className="btn-secondary" onClick={onSkip}>Skip</button>}
      </div>
    </div>
  )
}

interface AmountEntry {
  verb: Verb
  optional: boolean
  street: StreetName
  index: number
}

export default function HandEditor({ initialRaw, defaultStakes, onSave, onCancel }: Props) {
  const [state, setState] = useState<HandState>(() =>
    initialRaw ? parseHand(initialRaw) : createBlank(),
  )
  const [history, setHistory] = useState<HandState[]>([])
  const [pendingCards, setPendingCards] = useState<string[]>([])
  const [amountInput, setAmountInput] = useState('')
  const [selectedStakes, setSelectedStakes] = useState<string | null>(
    initialRaw ? null : (defaultStakes ?? null),
  )
  const [freeInput, setFreeInput] = useState('')
  const [showFree, setShowFree] = useState(false)
  const [activeEdit, setActiveEdit] = useState<Chip | null>(null)
  const [amountEntry, setAmountEntry] = useState<AmountEntry | null>(null)

  // ── Core state transition: snapshot for undo, apply, reset transient UI ──────
  function apply(next: HandState) {
    setHistory((h) => [...h, state])
    setState(next)
    setPendingCards([])
    setAmountInput('')
    setAmountEntry(null)
    setActiveEdit(null)
    setShowFree(false)
    setFreeInput('')
  }

  function undo() {
    if (history.length === 0) return
    setState(history[history.length - 1])
    setHistory((h) => h.slice(0, -1))
    setPendingCards([])
    setAmountInput('')
    setAmountEntry(null)
    setActiveEdit(null)
  }

  function handleSave() {
    if (!isComplete(state)) return
    onSave(serializeHand(state), state)
  }

  function openEdit(chip: Chip) {
    setPendingCards([])
    setAmountEntry(null)
    setAmountInput(chip.editKind === 'note' ? chip.text.replace(/^#\s*/, '') : '')
    setActiveEdit(chip)
  }

  function cancelEdit() {
    setActiveEdit(null)
    setAmountEntry(null)
    setPendingCards([])
    setAmountInput('')
  }

  // Pick a verb for the action at (street, index): branch into amount entry when needed.
  function chooseVerb(street: StreetName, index: number, verb: Verb) {
    if (verb === 'r' || verb === 'b') {
      setAmountEntry({ verb, optional: false, street, index })
      setAmountInput('')
    } else if (verb === 'a') {
      setAmountEntry({ verb: 'a', optional: true, street, index })
      setAmountInput('')
    } else {
      apply(setVerb(state, street, index, verb))
    }
  }

  function submitAmount(amount: number) {
    if (!amountEntry) return
    apply(setVerb(state, amountEntry.street, amountEntry.index, amountEntry.verb, amount))
  }

  function skipAmount() {
    if (!amountEntry) return
    apply(setVerb(state, amountEntry.street, amountEntry.index, amountEntry.verb))
  }

  function commitNote(note: string) {
    if (!note.trim()) return
    apply(addNote(state, note))
  }

  const step = nextStep(state)
  const chipLines = buildEditorView(state)

  // ── Chip styling ────────────────────────────────────────────────────────────
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
    if (chip.kind === 'board-card' || chip.kind === 'hero-card' || chip.kind === 'showdown-card') {
      const suitCode = chip.meta?.cardCode?.[1]
      return { ...base, color: suitCode ? SUIT_COLORS[suitCode] : 'var(--text)', fontWeight: chip.kind === 'hero-card' ? 600 : 500 }
    }
    if (chip.kind === 'board-card-add') {
      return { ...base, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700 }
    }
    if (chip.kind === 'hero-pos') {
      return { ...base, background: HERO_COLOR, color: '#000', border: 'none', fontWeight: 700 }
    }
    if (chip.kind === 'action-actor' || chip.kind === 'showdown-actor') {
      const color = actorColor(chip.meta?.actor ?? '')
      return { ...base, color, fontWeight: chip.meta?.actor === 'H' ? 700 : 500 }
    }
    if (chip.kind === 'action-verb' || chip.kind === 'showdown-verb') {
      return { ...base, color: 'var(--text-muted)' }
    }
    if (chip.kind === 'note') {
      return { ...base, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }
    }
    if (chip.kind === 'label') {
      return { ...base, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'default', padding: '0.2rem 0' }
    }
    return base
  }

  function sectionHeader(key: string): string | null {
    if (key === 'stakes') return 'Stakes'
    if (key === 'board' || key === 'board:empty') return 'Board'
    if (key === 'hero') return 'Hero'
    if (key === 'showdown') return 'Showdown'
    if (key.startsWith('street:')) return key.slice('street:'.length)
    return null
  }

  const headerStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    minWidth: 56,
    flexShrink: 0,
  }

  const recordedDisplay = chipLines.length > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {chipLines.map((line) => (
        <div key={line.key} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {sectionHeader(line.key) && <span style={headerStyle}>{sectionHeader(line.key)}</span>}
          {line.chips.map((chip) =>
            chip.editKind ? (
              <button key={chip.id} data-chip-id={chip.id} onClick={() => openEdit(chip)} style={chipStyle(chip)}>
                {chip.text}
              </button>
            ) : (
              <span key={chip.id} style={chipStyle(chip)}>{chip.text}</span>
            ),
          )}
        </div>
      ))}
    </div>
  ) : null

  // ── Card picker used set, excluding the card currently being edited ──────────
  function usedExcept(code?: string): Set<string> {
    const used = new Set(usedCards(state))
    if (code) used.delete(code)
    return used
  }

  // ── Edit overlay ────────────────────────────────────────────────────────────
  let editContent: ReactNode = null
  if (activeEdit && !amountEntry) {
    const chip = activeEdit
    const editHeaderLabel = chip.editKind === 'board-card-add' ? 'Add board card' : `Editing: ${chip.text}`
    const editHeader = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <StepLabel>{editHeaderLabel}</StepLabel>
        <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={cancelEdit} data-testid="cancel-edit">Cancel edit</button>
      </div>
    )

    if (chip.editKind === 'board-card') {
      editContent = (
        <div>{editHeader}
          <CardGrid usedCards={usedExcept(chip.meta?.cardCode)} selected={[]} onToggle={(c) => apply(editBoardCard(state, chip.cardIndex!, toCard(c)))} />
        </div>
      )
    } else if (chip.editKind === 'board-card-add') {
      editContent = (
        <div>{editHeader}
          <CardGrid usedCards={usedExcept()} selected={[]} onToggle={(c) => apply(addBoardCard(state, toCard(c)))} />
        </div>
      )
    } else if (chip.editKind === 'hero-card') {
      editContent = (
        <div>{editHeader}
          <CardGrid usedCards={usedExcept(chip.meta?.cardCode)} selected={[]} onToggle={(c) => apply(editHeroCard(state, chip.cardIndex!, toCard(c)))} />
        </div>
      )
    } else if (chip.editKind === 'showdown-card') {
      editContent = (
        <div>{editHeader}
          <CardGrid usedCards={usedExcept(chip.meta?.cardCode)} selected={[]} onToggle={(c) => apply(editShowdownCard(state, chip.index!, chip.cardIndex!, toCard(c)))} />
        </div>
      )
    } else if (chip.editKind === 'hero-pos') {
      editContent = (
        <div>{editHeader}
          <ButtonRow>{HERO_POSITIONS.map((pos) => (
            <button key={pos} className="btn-secondary" onClick={() => apply(editHeroPosition(state, pos))}>{pos}</button>
          ))}</ButtonRow>
        </div>
      )
    } else if (chip.editKind === 'actor') {
      const options = legalActorsForActionSlot(state, chip.street!, chip.index!)
      editContent = (
        <div>{editHeader}
          <ButtonRow>{options.map((pos) => (
            <button key={pos} className="btn-secondary" onClick={() => apply(editActor(state, chip.street!, chip.index!, pos))}>{pos}</button>
          ))}</ButtonRow>
        </div>
      )
    } else if (chip.editKind === 'verb') {
      const { verbs } = legalVerbsForActionSlot(state, chip.street!, chip.index!)
      editContent = (
        <div>{editHeader}
          <ButtonRow>{verbs.map((v) => (
            <button key={v} className="btn-secondary" onClick={() => chooseVerb(chip.street!, chip.index!, v)}>{VERB_LABELS[v]}</button>
          ))}</ButtonRow>
        </div>
      )
    } else if (chip.editKind === 'showdown-actor') {
      const options = legalShowdownActorsForSlot(state, chip.index!)
      editContent = (
        <div>{editHeader}
          <ButtonRow>{options.map((pos) => (
            <button key={pos} className="btn-secondary" onClick={() => apply(editShowdownActor(state, chip.index!, pos))}>{pos}</button>
          ))}</ButtonRow>
        </div>
      )
    } else if (chip.editKind === 'showdown-verb') {
      editContent = (
        <div>{editHeader}
          <ButtonRow>{SHOWDOWN_VERBS.map((v) => (
            <button key={v} className="btn-secondary" onClick={() => apply(editShowdownVerb(state, chip.index!, v))}>{SHOWDOWN_VERB_LABELS[v]}</button>
          ))}</ButtonRow>
        </div>
      )
    } else if (chip.editKind === 'stakes') {
      editContent = (
        <div>{editHeader}
          <ButtonRow>{STAKES_PRESETS.map((s) => (
            <button key={s} className="btn-secondary" onClick={() => apply(setStakes(state, s))}>{s}</button>
          ))}</ButtonRow>
        </div>
      )
    } else if (chip.editKind === 'note') {
      const isValid = amountInput.trim().length > 0
      editContent = (
        <div>{editHeader}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && isValid) apply(editNote(state, chip.noteId!, amountInput.trim())) }}
              autoFocus
              placeholder="note…"
              style={inputStyle}
            />
            <button className="btn-primary" disabled={!isValid} onClick={() => apply(editNote(state, chip.noteId!, amountInput.trim()))}>OK</button>
          </div>
        </div>
      )
    }
  }

  // ── Wizard step content ─────────────────────────────────────────────────────
  let stepLabel = ''
  let stepContent: ReactNode = null

  if (amountEntry) {
    stepLabel = amountEntry.optional ? 'Effective amount (optional)' : 'Amount'
    stepContent = (
      <ChipAmountInput
        amountInput={amountInput}
        onAmountChange={setAmountInput}
        onSubmit={submitAmount}
        onSkip={amountEntry.optional ? skipAmount : undefined}
      />
    )
  } else if (step.kind === 'board') {
    const validCount = pendingCards.length === 0 || (pendingCards.length >= 3 && pendingCards.length <= 5)
    const commitBoard = (cards: Card[]) => {
      let next = setBoard(state, cards)
      if (selectedStakes) next = setStakes(next, selectedStakes)
      apply(next)
    }
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
            <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }} onClick={() => setSelectedStakes(null)}>None</button>
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
            <button className="btn-secondary" onClick={() => commitBoard([])}>No board</button>
          )}
          {pendingCards.length > 0 && (
            <button className="btn-primary" disabled={!validCount} onClick={() => commitBoard(pendingCards.map(toCard))}>
              Done ({pendingCards.length})
            </button>
          )}
          {pendingCards.length > 0 && pendingCards.length < 3 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>need {3 - pendingCards.length} more</span>
          )}
        </div>
      </>
    )
  } else if (step.kind === 'heroPosition') {
    stepLabel = 'Hero position'
    stepContent = (
      <ButtonRow>{step.options.map((pos) => (
        <button key={pos} className="btn-secondary" onClick={() => apply(setHeroPosition(state, pos))}>{pos}</button>
      ))}</ButtonRow>
    )
  } else if (step.kind === 'heroCards') {
    const isValid = pendingCards.length === 2
    stepLabel = `Hero hole cards — ${pendingCards.length}/2`
    stepContent = (
      <>
        <CardGrid
          usedCards={usedCards(state)}
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
          <button className="btn-primary" disabled={!isValid} onClick={() => apply(setHeroCards(state, [toCard(pendingCards[0]), toCard(pendingCards[1])]))}>
            {isValid ? `Done — ${pendingCards.join(' ')}` : 'Pick 2 cards'}
          </button>
        </div>
      </>
    )
  } else if (step.kind === 'actor') {
    const currentStreet = step.street
    const next = nextStreetName(state)
    stepLabel = currentStreet
    stepContent = (
      <>
        <ButtonRow>{step.options.map((actor) => (
          <button key={actor} className="btn-secondary" onClick={() => apply(beginAction(state, currentStreet, actor))}>{actor}</button>
        ))}</ButtonRow>
        {(step.canAdvance || step.canShowdown || step.canSave) && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {step.canAdvance && next && (
              <button className="btn-secondary" onClick={() => apply(advanceToStreet(state, next))}>→ {next}</button>
            )}
            {step.canShowdown && (
              <button className="btn-secondary" onClick={() => apply(beginShowdown(state))}>→ Showdown</button>
            )}
            {step.canSave && (
              <button className="btn-primary" onClick={handleSave}>Save hand</button>
            )}
          </div>
        )}
      </>
    )
  } else if (step.kind === 'verb') {
    const trailingIndex = (state.streets.find((s) => s.name === step.street)?.actions.length ?? 1) - 1
    stepLabel = 'Action'
    stepContent = (
      <ButtonRow>{step.options.map((v) => (
        <button key={v} className="btn-secondary" onClick={() => chooseVerb(step.street, trailingIndex, v)}>{VERB_LABELS[v]}</button>
      ))}</ButtonRow>
    )
  } else if (step.kind === 'showdownActor') {
    stepLabel = 'Showdown'
    stepContent = (
      <>
        <ButtonRow>{step.options.map((actor) => (
          <button key={actor} className="btn-secondary" onClick={() => apply(beginShowdownActor(state, actor))}>{actor}</button>
        ))}</ButtonRow>
        {step.canSave && (
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn-primary" onClick={handleSave}>Save hand</button>
          </div>
        )}
      </>
    )
  } else if (step.kind === 'showdownVerb') {
    const sdIndex = (state.showdown?.length ?? 1) - 1
    stepLabel = 'Showdown action'
    stepContent = (
      <ButtonRow>{SHOWDOWN_VERBS.map((v) => (
        <button key={v} className="btn-secondary" onClick={() => apply(setShowdownVerb(state, sdIndex, v))}>{SHOWDOWN_VERB_LABELS[v]}</button>
      ))}</ButtonRow>
    )
  } else if (step.kind === 'showdownCards') {
    const sdIndex = (state.showdown?.length ?? 1) - 1
    const isValid = pendingCards.length === 2
    stepLabel = 'Shown cards'
    stepContent = (
      <>
        <CardGrid
          usedCards={usedCards(state)}
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
          <button className="btn-primary" disabled={!isValid} onClick={() => apply(setShowdownCards(state, sdIndex, [toCard(pendingCards[0]), toCard(pendingCards[1])]))}>
            {isValid ? `Done — ${pendingCards.join(' ')}` : 'Pick 2 cards'}
          </button>
        </div>
      </>
    )
  }

  // ── Header ───────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{initialRaw !== undefined ? 'Edit hand' : 'New hand'}</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {history.length > 0 && <button className="btn-secondary" onClick={undo}>← Undo</button>}
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )

  // ── Free-text note ────────────────────────────────────────────────────────────
  const freeSection = (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      {!showFree ? (
        <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => setShowFree(true)}>··· type manually</button>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={freeInput} onChange={(e) => setFreeInput(e.target.value)} autoFocus placeholder="note to add…" style={inputStyle} />
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
        {editContent ? (
          editContent
        ) : (
          <>
            <StepLabel>{stepLabel}</StepLabel>
            {stepContent}
          </>
        )}
      </div>
      {freeSection}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
  fontFamily: 'inherit',
}

function ButtonRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{children}</div>
}

function StepLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </div>
  )
}
