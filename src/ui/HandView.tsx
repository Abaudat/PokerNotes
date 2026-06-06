import { useState } from 'react'
import { buildHandViewModel, HERO_COLOR, POSITION_COLORS } from '../core/render'
import { formatForExport } from '../core/export'
import { SUIT_GLYPHS } from '../core/cards'
import type { SavedHand } from '../app/App'
import type { Position } from '../core/types'

const SUIT_COLORS: Record<string, string> = {
  '♠': '#94a3b8',
  '♥': '#f87171',
  '♦': '#fb923c',
  '♣': '#4ade80',
}

function formatCardGlyph(code: string): React.ReactNode {
  if (code.length !== 2) return code
  const rank = code[0]
  const suitCode = code[1] as keyof typeof SUIT_GLYPHS
  const glyph = SUIT_GLYPHS[suitCode] ?? suitCode
  const color = SUIT_COLORS[glyph] ?? 'inherit'
  return (
    <span>
      {rank}
      <span style={{ color }}>{glyph}</span>
    </span>
  )
}

function actorColor(actor: string): string {
  if (actor === 'H') return HERO_COLOR
  return POSITION_COLORS[actor as Exclude<Position, 'H'>] ?? '#6b7280'
}

const VERB_LABELS: Record<string, string> = {
  x: 'checks',
  c: 'calls',
  r: 'raises',
  f: 'folds',
  b: 'bets',
}

interface Props {
  hand: SavedHand
  onBack: () => void
  onEdit: () => void
}

export default function HandView({ hand, onBack, onEdit }: Props) {
  const [copied, setCopied] = useState(false)
  const vm = buildHandViewModel(hand.ast)

  function handleExport() {
    const text = formatForExport(hand.ast)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button className="btn-secondary" onClick={onBack}>← History</button>
        <button className="btn-secondary" onClick={onEdit}>Edit</button>
        <button className="btn-secondary" onClick={handleExport} style={{ marginLeft: 'auto' }}>
          {copied ? '✓ Copied!' : 'Export'}
        </button>
      </div>

      {/* Stakes + meta */}
      {vm.stakes && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {vm.stakes} NLH &nbsp;·&nbsp; {hand.savedAt.toLocaleString()}
        </div>
      )}

      {/* Hero */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              background: HERO_COLOR,
              color: '#000',
              borderRadius: 4,
              padding: '0.15rem 0.5rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
            }}
          >
            HERO
          </span>
          <span style={{ color: HERO_COLOR, fontWeight: 600 }}>{vm.hero.position}</span>
          <span className="card-glyph" style={{ color: 'var(--text)', letterSpacing: '0.15em' }}>
            {formatCardGlyph(vm.hero.cards[0])}
            {' '}
            {formatCardGlyph(vm.hero.cards[1])}
          </span>
        </div>
      </section>

      {/* Board */}
      {vm.board.length > 0 && (
        <section>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Board
          </div>
          <div className="card-glyph" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {vm.board.map((code, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0.2rem 0.5rem',
                  fontSize: '1rem',
                }}
              >
                {formatCardGlyph(code)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Streets */}
      {vm.streets.map((street) => (
        <section key={street.name}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {street.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {street.actions.map((action) => {
              const color = actorColor(action.actor)
              const label = action.isHero ? 'Hero' : action.actor
              const verbWord = VERB_LABELS[action.verb] ?? action.verb
              const amountStr = action.amount !== undefined ? ` $${action.amount}` : ''
              return (
                <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <span
                    style={{
                      color,
                      fontWeight: action.isHero ? 700 : 500,
                      minWidth: 60,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{verbWord}{amountStr}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
