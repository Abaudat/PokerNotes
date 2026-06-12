import React from 'react'
import { HERO_COLOR } from '../core/render'
import { CardGlyph } from './cardGlyphs'
import type { ListedHand } from '../data/repository'
import { groupHandsByDate } from './handHistoryGrouping'

const STREET_COUNT: Record<string, number> = { Preflop: 1, Flop: 2, Turn: 3, River: 4 }

function heroPreview(heroCards: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  for (let i = 0; i + 1 < heroCards.length; i += 2) {
    if (nodes.length > 0) nodes.push(' ')
    nodes.push(<CardGlyph key={i} code={heroCards.slice(i, i + 2)} />)
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
    <div className="stack">
      <div className="row-between">
        <h2>Hand history</h2>
        <button className="btn-primary" onClick={onNew}>+ New hand</button>
      </div>

      {hands.length === 0 && (
        <div className="empty-state">
          No hands yet.{' '}
          <span className="empty-state-link" onClick={onNew}>
            Record your first hand.
          </span>
        </div>
      )}

      {groupHandsByDate(hands).map((group) => (
        <React.Fragment key={group.label}>
          <div className="section-label history-date-label">{group.label}</div>

          {group.hands.map((hand) => {
            const { stakes, heroPosition, heroCards, streetReached, totalPot } = hand.summary
            const streetCount = STREET_COUNT[streetReached] ?? 1
            const cards = heroPreview(heroCards)
            const time = hand.createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={hand.id} className="panel hand-card" onClick={() => onView(hand.id)}>
                <div className="hand-card-cards">{cards}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hand-card-title">
                    {stakes ? `${stakes.replace(/\$/g, '')} NLH` : 'Unspecified stakes'}
                    {' · '}
                    <span style={{ color: HERO_COLOR }}>{heroPosition}</span>
                    {totalPot !== undefined && (
                      <> · <span className="muted" style={{ fontWeight: 400 }}>Pot: {totalPot}</span></>
                    )}
                  </div>
                  <div className="hand-card-meta">
                    {streetCount} street{streetCount !== 1 ? 's' : ''} &nbsp;·&nbsp; {time}
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
        </React.Fragment>
      ))}
    </div>
  )
}
