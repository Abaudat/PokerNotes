import { describe, it, expect } from 'vitest'
import { buildRecordingView, applyChipEdit, usedCardsExcept } from './recordingView'
import { isLastActionABet } from './suggestions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chipById(raw: string, id: string) {
  for (const line of buildRecordingView(raw)) {
    for (const chip of line.chips) {
      if (chip.id === id) return chip
    }
  }
  return undefined
}

function sliceSpan(raw: string, id: string): string | null {
  const chip = chipById(raw, id)
  if (!chip?.span) return null
  return raw.slice(chip.span.start, chip.span.end)
}

// ---------------------------------------------------------------------------
// Robustness — never throws
// ---------------------------------------------------------------------------

describe('buildRecordingView robustness', () => {
  it('handles empty string', () => {
    expect(buildRecordingView('')).toEqual([])
  })

  it('handles Board: only (no cards)', () => {
    const lines = buildRecordingView('Board:\nHero: ')
    const boardLine = lines.find((l) => l.key === 'board:empty')
    expect(boardLine).toBeDefined()
    expect(boardLine!.chips[0].text).toBe('No board')
    expect(boardLine!.chips[0].editKind).toBeNull()
  })

  it('handles Hero: with position but no cards yet', () => {
    const raw = 'Board: As 8h Td\nHero: BTN '
    const lines = buildRecordingView(raw)
    const heroLine = lines.find((l) => l.key === 'hero')
    expect(heroLine).toBeDefined()
    // Position chip present but no card chips
    expect(heroLine!.chips.some((c) => c.id === 'hero:pos')).toBe(true)
    expect(heroLine!.chips.some((c) => c.id === 'hero:card:0')).toBe(false)
  })

  it('handles trailing incomplete action segment', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r '
    // Should not throw, and only the actor chip for H should appear (no verb yet)
    const lines = buildRecordingView(raw)
    const streetLine = lines.find((l) => l.key === 'street:Preflop')
    expect(streetLine).toBeDefined()
    const ids = streetLine!.chips.map((c) => c.id)
    expect(ids).toContain('action:Preflop:0:actor')
    expect(ids).not.toContain('action:Preflop:0:verb')
  })

  it('handles interleaved note lines', () => {
    const raw = 'Board: As 8h Td\n# my note\nHero: BTN AhKs\nPreflop: H x'
    const lines = buildRecordingView(raw)
    const keys = lines.map((l) => l.key)
    expect(keys).toContain('note:0')
  })
})

// ---------------------------------------------------------------------------
// Stakes span
// ---------------------------------------------------------------------------

describe('stakes chip', () => {
  const raw = '[Stakes: 2/5]\nBoard: As 8h Td\nHero: BTN AhKs\nPreflop: H x'

  it('span slices to the stakes value', () => {
    expect(sliceSpan(raw, 'stakes')).toBe('2/5')
  })

  it('text equals stakes value', () => {
    expect(chipById(raw, 'stakes')?.text).toBe('2/5')
  })

  it('editKind is stakes', () => {
    expect(chipById(raw, 'stakes')?.editKind).toBe('stakes')
  })
})

// ---------------------------------------------------------------------------
// Board cards spans (space-separated)
// ---------------------------------------------------------------------------

describe('board card chips', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'

  it('span for board card 0 slices to As', () => {
    expect(sliceSpan(raw, 'board:0')).toBe('As')
  })

  it('span for board card 1 slices to 8h', () => {
    expect(sliceSpan(raw, 'board:1')).toBe('8h')
  })

  it('span for board card 2 slices to Td', () => {
    expect(sliceSpan(raw, 'board:2')).toBe('Td')
  })

  it('editKind is board-card', () => {
    expect(chipById(raw, 'board:0')?.editKind).toBe('board-card')
  })

  it('meta.cardCode matches raw slice', () => {
    const chip = chipById(raw, 'board:1')
    expect(chip?.meta?.cardCode).toBe('8h')
  })
})

// ---------------------------------------------------------------------------
// Board "add card" chip
// ---------------------------------------------------------------------------

describe('board:add chip', () => {
  it('appears for a 3-card board', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:add')
    expect(chip).toBeDefined()
    expect(chip!.editKind).toBe('board-card-add')
  })

  it('does not appear for a 5-card board', () => {
    const raw = 'Board: As 8h Td Jc 2s\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:add')
    expect(chip).toBeUndefined()
  })

  it('appears for a 4-card board', () => {
    const raw = 'Board: As 8h Td Jc\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:add')
    expect(chip).toBeDefined()
  })

  it('appears for an empty board', () => {
    const raw = 'Board:\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:add')
    expect(chip).toBeDefined()
  })

  it('inserting at a 3-card board span adds a 4th card', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:add')!
    const result = applyChipEdit(raw, chip.span!, ' Jc')
    expect(result.startsWith('Board: As 8h Td Jc')).toBe(true)
  })

  it('inserting at an empty board span adds the first card', () => {
    const raw = 'Board:\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:add')!
    const result = applyChipEdit(raw, chip.span!, ' As')
    expect(result.startsWith('Board: As')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Hero position span
// ---------------------------------------------------------------------------

describe('hero position chip', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'

  it('span slices to BTN', () => {
    expect(sliceSpan(raw, 'hero:pos')).toBe('BTN')
  })

  it('editKind is hero-pos', () => {
    expect(chipById(raw, 'hero:pos')?.editKind).toBe('hero-pos')
  })
})

// ---------------------------------------------------------------------------
// Hero cards spans (packed, no space)
// ---------------------------------------------------------------------------

describe('hero card chips (packed)', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'

  it('span for hero card 0 slices to Ah', () => {
    expect(sliceSpan(raw, 'hero:card:0')).toBe('Ah')
  })

  it('span for hero card 1 slices to Ks', () => {
    expect(sliceSpan(raw, 'hero:card:1')).toBe('Ks')
  })

  it('both hero cards have editKind hero-card', () => {
    expect(chipById(raw, 'hero:card:0')?.editKind).toBe('hero-card')
    expect(chipById(raw, 'hero:card:1')?.editKind).toBe('hero-card')
  })
})

// ---------------------------------------------------------------------------
// Action actor chips
// ---------------------------------------------------------------------------

describe('action actor chip', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x, BB c'

  it('span for first actor (H) slices correctly', () => {
    expect(sliceSpan(raw, 'action:Preflop:0:actor')).toBe('H')
  })

  it('span for second actor (BB) slices correctly', () => {
    expect(sliceSpan(raw, 'action:Preflop:1:actor')).toBe('BB')
  })

  it('editKind is actor', () => {
    expect(chipById(raw, 'action:Preflop:0:actor')?.editKind).toBe('actor')
  })
})

// ---------------------------------------------------------------------------
// Action verb chips (verb+amount union span)
// ---------------------------------------------------------------------------

describe('action verb chip — check (no amount)', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'

  it('span slices to x', () => {
    expect(sliceSpan(raw, 'action:Preflop:0:verb')).toBe('x')
  })

  it('text is Check', () => {
    expect(chipById(raw, 'action:Preflop:0:verb')?.text).toBe('Check')
  })
})

describe('action verb chip — bet with amount', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H b 50'

  it('span covers "b 50"', () => {
    expect(sliceSpan(raw, 'action:Preflop:0:verb')).toBe('b 50')
  })

  it('meta.amount is 50', () => {
    expect(chipById(raw, 'action:Preflop:0:verb')?.meta?.amount).toBe(50)
  })
})

describe('action verb chip — raise with amount', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c'

  it('span covers "r 15"', () => {
    expect(sliceSpan(raw, 'action:Preflop:0:verb')).toBe('r 15')
  })
})

describe('action verb chip — all in (two words) with amount', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H all in 200'

  it('span covers "all in 200"', () => {
    expect(sliceSpan(raw, 'action:Preflop:0:verb')).toBe('all in 200')
  })

  it('meta.verb is a', () => {
    expect(chipById(raw, 'action:Preflop:0:verb')?.meta?.verb).toBe('a')
  })
})

describe('action verb chip — all in (two words) without amount', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H all in, BB c'

  it('span covers "all in"', () => {
    expect(sliceSpan(raw, 'action:Preflop:0:verb')).toBe('all in')
  })
})

// ---------------------------------------------------------------------------
// Facing-bet meta
// ---------------------------------------------------------------------------

describe('facingBet meta', () => {
  it('is true for non-BB preflop first actor (implicit BB bet)', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    expect(chipById(raw, 'action:Preflop:0:verb')?.meta?.facingBet).toBe(true)
  })

  it('is true when prior action was a bet', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB b 20, H c'
    expect(chipById(raw, 'action:Preflop:1:verb')?.meta?.facingBet).toBe(true)
  })

  it('is true when prior action was a raise', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB r 30, H c'
    expect(chipById(raw, 'action:Preflop:1:verb')?.meta?.facingBet).toBe(true)
  })

  it('is true for non-BB after BB check (still facing implicit BB)', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB x, H x'
    expect(chipById(raw, 'action:Preflop:1:verb')?.meta?.facingBet).toBe(true)
  })

  it('is false and bbOption true for BB preflop with no prior raise', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: BB x'
    const chip = chipById(raw, 'action:Preflop:0:verb')
    expect(chip?.meta?.facingBet).toBe(false)
    expect(chip?.meta?.bbOption).toBe(true)
  })

  it('is true for BB preflop after a raise', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: UTG r 15, BB c'
    expect(chipById(raw, 'action:Preflop:1:verb')?.meta?.facingBet).toBe(true)
  })

  it('is false for first actor on postflop (no prior bet)', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 40, BB c\nFlop: BB x'
    expect(chipById(raw, 'action:Flop:0:verb')?.meta?.facingBet).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Showdown chips
// ---------------------------------------------------------------------------

describe('showdown chips', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x\nShowdown: H shows QcJd'

  it('showdown actor span slices to H', () => {
    expect(sliceSpan(raw, 'showdown:0:actor')).toBe('H')
  })

  it('showdown verb span slices to shows', () => {
    expect(sliceSpan(raw, 'showdown:0:verb')).toBe('shows')
  })

  it('showdown card 0 span slices to Qc', () => {
    expect(sliceSpan(raw, 'showdown:0:card:0')).toBe('Qc')
  })

  it('showdown card 1 span slices to Jd', () => {
    expect(sliceSpan(raw, 'showdown:0:card:1')).toBe('Jd')
  })
})

describe('showdown wins/loses verb', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x\nShowdown: H wins'

  it('showdown verb span slices to wins', () => {
    expect(sliceSpan(raw, 'showdown:0:verb')).toBe('wins')
  })
})

// ---------------------------------------------------------------------------
// Stable IDs
// ---------------------------------------------------------------------------

describe('stable IDs', () => {
  it('same element has same id across two calls', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    const ids1 = buildRecordingView(raw).flatMap((l) => l.chips.map((c) => c.id))
    const ids2 = buildRecordingView(raw).flatMap((l) => l.chips.map((c) => c.id))
    expect(ids1).toEqual(ids2)
  })
})

// ---------------------------------------------------------------------------
// applyChipEdit
// ---------------------------------------------------------------------------

describe('applyChipEdit', () => {
  it('swaps a board card code', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'board:0')!
    const result = applyChipEdit(raw, chip.span!, 'Kc')
    expect(result.startsWith('Board: Kc')).toBe(true)
  })

  it('changes check to fold (drops no amount)', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x, BB c'
    const chip = chipById(raw, 'action:Preflop:0:verb')!
    const result = applyChipEdit(raw, chip.span!, 'f')
    expect(result).toContain('H f')
    expect(result).not.toContain('H x')
  })

  it('changes bet 50 to check (drops amount)', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H b 50'
    const chip = chipById(raw, 'action:Preflop:0:verb')!
    const result = applyChipEdit(raw, chip.span!, 'x')
    expect(result).toContain('H x')
    expect(result).not.toContain('50')
  })

  it('changes check to raise 30', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'action:Preflop:0:verb')!
    const result = applyChipEdit(raw, chip.span!, 'r 30')
    expect(result).toContain('H r 30')
  })

  it('changes all in 300 to all in (skip amount)', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H all in 300'
    const chip = chipById(raw, 'action:Preflop:0:verb')!
    const result = applyChipEdit(raw, chip.span!, 'all in')
    expect(result).toContain('H all in')
    expect(result).not.toContain('300')
  })

  it('changes all in to all in 500', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H all in, BB c'
    const chip = chipById(raw, 'action:Preflop:0:verb')!
    const result = applyChipEdit(raw, chip.span!, 'all in 500')
    expect(result).toContain('H all in 500')
  })

  it('swaps a showdown card', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x\nShowdown: H shows QcJd'
    const chip = chipById(raw, 'showdown:0:card:0')!
    const result = applyChipEdit(raw, chip.span!, 'Tc')
    expect(result).toContain('Tc')
    expect(result).not.toContain('Qc')
  })

  it('swaps hero position', () => {
    const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'
    const chip = chipById(raw, 'hero:pos')!
    const result = applyChipEdit(raw, chip.span!, 'CO')
    expect(result).toContain('Hero: CO')
  })
})

// ---------------------------------------------------------------------------
// usedCardsExcept
// ---------------------------------------------------------------------------

describe('usedCardsExcept', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x'

  it('excludes board cards from used set', () => {
    const chip = chipById(raw, 'board:0')! // As
    const used = usedCardsExcept(raw, chip.span!)
    expect(used.has('8h')).toBe(true)
    expect(used.has('Td')).toBe(true)
    expect(used.has('Ah')).toBe(true)
    expect(used.has('Ks')).toBe(true)
  })

  it('keeps the edited card selectable (not in used set)', () => {
    const chip = chipById(raw, 'board:0')! // As
    const used = usedCardsExcept(raw, chip.span!)
    expect(used.has('As')).toBe(false)
  })

  it('excludes both hero cards from used set', () => {
    const chip = chipById(raw, 'hero:card:0')! // Ah
    const used = usedCardsExcept(raw, chip.span!)
    expect(used.has('Ks')).toBe(true)
    expect(used.has('As')).toBe(true) // board
    expect(used.has('Ah')).toBe(false) // this is the edited card
  })
})

// ---------------------------------------------------------------------------
// isLastActionABet (re-exported)
// ---------------------------------------------------------------------------

describe('isLastActionABet', () => {
  it('returns false for empty segments', () => {
    expect(isLastActionABet([])).toBe(false)
  })

  it('returns true when last action is a bet', () => {
    expect(isLastActionABet(['BB b 20'])).toBe(true)
  })

  it('returns true when last action is a raise', () => {
    expect(isLastActionABet(['BB r 30'])).toBe(true)
  })

  it('returns true when last action is all in', () => {
    expect(isLastActionABet(['H all in 200'])).toBe(true)
  })

  it('returns false when last action is check', () => {
    expect(isLastActionABet(['BB x'])).toBe(false)
  })

  it('returns false when last action is call', () => {
    expect(isLastActionABet(['BB c'])).toBe(false)
  })

  it('returns false when last action is fold', () => {
    expect(isLastActionABet(['BB f'])).toBe(false)
  })

  it('returns true when any earlier segment was a bet, even if last was a call', () => {
    expect(isLastActionABet(['BB b 20', 'H c'])).toBe(true)
  })
})
