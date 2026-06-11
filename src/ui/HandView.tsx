import { useState } from 'react'
import { buildHandViewModel } from '../core/render'
import { formatForExport } from '../core/export'
import { CardTile } from './cardGlyphs'
import type { SavedHand } from '../app/App'

const VERB_LABELS: Record<string, string> = {
  x: 'checks',
  c: 'calls',
  r: 'raises',
  f: 'folds',
  b: 'bets',
  a: 'all in',
}

interface Props {
  hand: SavedHand
  onBack: () => void
  onEdit: () => void
}

export default function HandView({ hand, onBack, onEdit }: Props) {
  const [copied, setCopied] = useState(false)
  const vm = buildHandViewModel(hand.state)

  function handleExport() {
    const text = formatForExport(hand.state)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="stack-lg">
      {/* Toolbar */}
      <div className="row">
        <button className="btn-secondary" onClick={onBack}>← History</button>
        <button className="btn-secondary" onClick={onEdit}>Edit</button>
        <button className="btn-secondary" onClick={handleExport} style={{ marginLeft: 'auto' }}>
          {copied ? '✓ Copied!' : 'Export'}
        </button>
      </div>

      {/* Stakes + meta */}
      {vm.stakes && (
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {vm.stakes} NLH &nbsp;·&nbsp; {hand.savedAt.toLocaleString()}
        </div>
      )}

      {/* Hero */}
      <section>
        <div className="row" style={{ gap: '0.75rem' }}>
          <span className="hero-badge">HERO</span>
          <span style={{ color: vm.hero.color, fontWeight: 600 }}>{vm.hero.position}</span>
          <span className="row" style={{ gap: '0.35rem' }}>
            <CardTile code={vm.hero.cards[0]} />
            <CardTile code={vm.hero.cards[1]} />
          </span>
        </div>
      </section>

      {/* Board */}
      {vm.board.length > 0 && (
        <section>
          <div className="section-label" style={{ marginBottom: '0.45rem' }}>Board</div>
          <div className="row-wrap" style={{ gap: '0.4rem' }}>
            {vm.board.map((code, i) => (
              <CardTile key={i} code={code} />
            ))}
          </div>
        </section>
      )}

      {/* Streets */}
      {vm.streets.map((street) => (
        <section key={street.name}>
          <div className="street-header">
            <div className="section-label">{street.name}</div>
            {street.name !== 'Preflop' && (
              <div className="pot-label">Pot: {street.potAtStart}</div>
            )}
          </div>
          <div className="stack-sm">
            {street.actions.map((action) => {
              const verbWord = VERB_LABELS[action.verb] ?? action.verb
              const amountStr = action.amount !== undefined
                ? action.verb === 'a' ? ` ${action.amount} eff` : ` $${action.amount}`
                : ''
              return (
                <div key={action.id} className="action-row">
                  <span
                    className="action-actor"
                    style={{ color: action.color, fontWeight: action.isHero ? 700 : 600 }}
                  >
                    {action.label}
                  </span>
                  <span className="muted">{verbWord}{amountStr}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Showdown */}
      {vm.showdown && vm.showdown.length > 0 && (
        <section>
          <div className="street-header">
            <div className="section-label">Showdown</div>
            {vm.showdownPot !== undefined && (
              <div className="pot-label">Pot: {vm.showdownPot}</div>
            )}
          </div>
          <div className="stack-sm">
            {vm.showdown.map((sa) => {
              return (
                <div key={sa.id} className="action-row">
                  <span
                    className="action-actor"
                    style={{ color: sa.color, fontWeight: sa.isHero ? 700 : 600 }}
                  >
                    {sa.label}
                  </span>
                  <span className="muted row" style={{ gap: '0.45rem' }}>
                    {sa.verb}
                    {sa.cards && (
                      <span className="row" style={{ gap: '0.3rem' }}>
                        <CardTile code={sa.cards[0]} />
                        <CardTile code={sa.cards[1]} />
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
