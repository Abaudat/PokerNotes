import React from 'react'
import { HERO_COLOR } from '../core/render'
import { SUIT_GLYPHS } from '../core/cards'
import type { ListedHand } from '../data/repository'

const STREET_COUNT: Record<string, number> = { Preflop: 1, Flop: 2, Turn: 3, River: 4 }

const SUIT_COLORS: Record<string, string> = {
  '♠': '#94a3b8',
  '♥': '#f87171',
  '♦': '#fb923c',
  '♣': '#4ade80',
}

function heroPreview(heroCards: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  for (let i = 0; i + 1 < heroCards.length; i += 2) {
    const rank = heroCards[i]
    const suitCode = heroCards[i + 1] as keyof typeof SUIT_GLYPHS
    const glyph = SUIT_GLYPHS[suitCode] ?? suitCode
    const color = SUIT_COLORS[glyph] ?? 'inherit'
    if (nodes.length > 0) nodes.push(' ')
    nodes.push(
      <span key={i}>
        {rank}
        <span style={{ color }}>{glyph}</span>
      </span>
    )
  }
  return <>{nodes}</>
}

interface Props {
  hands: ListedHand[]
  onNew: () => void
  onView: (id: string) => void
  onDelete: (id: string) => void
}

export default function HandHistory({ hands, onNew, onView, onDelete }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Hand history</h2>
        <button className="btn-primary" onClick={onNew}>+ New hand</button>
      </div>

      {hands.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '3rem 1rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          No hands yet.{' '}
          <span
            style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={onNew}
          >
            Record your first hand.
          </span>
        </div>
      )}

      {hands.map((hand) => {
        const { stakes, heroPosition, heroCards, streetReached, totalPot } = hand.summary
        const streetCount = STREET_COUNT[streetReached] ?? 1
        const cards = heroPreview(heroCards)
        const date = hand.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        const time = hand.createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

        return (
          <div
            key={hand.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
            }}
            onClick={() => onView(hand.id)}
          >
            <div
              style={{
                fontFamily: "'Cascadia Code', 'Fira Mono', monospace",
                fontSize: '1rem',
                color: HERO_COLOR,
                fontWeight: 700,
                minWidth: 60,
                flexShrink: 0,
              }}
            >
              {cards}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {stakes ? `${stakes.replace(/\$/g, '')} NLH` : 'Unspecified stakes'}
                {' · '}
                <span style={{ color: HERO_COLOR }}>H ({heroPosition})</span>
                {totalPot !== undefined && (
                  <> · <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Pot: {totalPot}</span></>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                {streetCount} street{streetCount !== 1 ? 's' : ''} &nbsp;·&nbsp; {date} {time}
              </div>
            </div>

            <button
              className="btn-danger"
              onClick={(e) => { e.stopPropagation(); onDelete(hand.id) }}
            >
              Delete
            </button>
          </div>
        )
      })}
    </div>
  )
}
