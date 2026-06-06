import { HERO_COLOR } from '../core/render'
import { SUIT_GLYPHS } from '../core/cards'
import type { SavedHand } from '../app/App'

function heroPreview(hand: SavedHand): string {
  const { cards } = hand.ast.hero
  return cards
    .map((t) => t.value.rank + SUIT_GLYPHS[t.value.suit])
    .join(' ')
}

interface Props {
  hands: SavedHand[]
  onNew: () => void
  onView: (hand: SavedHand) => void
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
        const stakes = hand.ast.stakes?.raw.value
        const pos = hand.ast.hero.position.value
        const cards = heroPreview(hand)
        const date = hand.savedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        const time = hand.savedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        const streetCount = hand.ast.streets.length

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
            onClick={() => onView(hand)}
          >
            {/* Hero cards */}
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

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {stakes ? `${stakes} NLH` : 'Unspecified stakes'}
                {' · '}
                <span style={{ color: HERO_COLOR }}>{pos}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                {streetCount} street{streetCount !== 1 ? 's' : ''} &nbsp;·&nbsp; {date} {time}
              </div>
            </div>

            {/* Delete button — stops propagation so click doesn't open the hand */}
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
