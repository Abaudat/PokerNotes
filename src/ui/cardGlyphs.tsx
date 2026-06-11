import { SUIT_GLYPHS } from '../core/cards'

const GLYPH_TO_SUIT: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' }

/** Suit letter ('s'|'h'|'d'|'c') from either a letter or a glyph; '' if unknown. */
function suitLetter(ch: string): string {
  if (ch in SUIT_GLYPHS) return ch
  return GLYPH_TO_SUIT[ch] ?? ''
}

/**
 * Inline card glyph: rank + suit symbol, suit tinted via .suit-* classes.
 * Accepts a 2-char code with either a letter suit ("As") or a glyph suit ("A♠").
 */
export function CardGlyph({ code }: { code: string }) {
  if (code.length !== 2) return <>{code}</>
  const rank = code[0]
  const suit = suitLetter(code[1])
  const glyph = SUIT_GLYPHS[suit as keyof typeof SUIT_GLYPHS] ?? code[1]
  return (
    <span>
      {rank}
      <span className={suit ? `suit-${suit}` : undefined}>{glyph}</span>
    </span>
  )
}

/** A small ivory playing-card tile (board / shown cards). */
export function CardTile({ code }: { code: string }) {
  return (
    <span className="playing-card">
      <CardGlyph code={code} />
    </span>
  )
}
