import { describe, it, expect } from 'vitest'
import { buildHandViewModel, buildEditorView, POSITION_COLORS, HERO_COLOR } from './render'
import { parseHand } from './parser'
import type { Chip } from './render'

const SAMPLE_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

// ===========================================================================
// buildHandViewModel
// ===========================================================================

describe('buildHandViewModel', () => {
  it('includes stakes text when present', () => {
    expect(buildHandViewModel(parseHand(SAMPLE_RAW)).stakes).toBe('$2/$5')
  })

  it('stakes is undefined when not present', () => {
    expect(buildHandViewModel(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c')).stakes).toBeUndefined()
  })

  it('maps board cards to display codes', () => {
    expect(buildHandViewModel(parseHand(SAMPLE_RAW)).board).toEqual(['As', '8h', 'Td'])
  })

  it('empty board yields empty array', () => {
    expect(buildHandViewModel(parseHand('Board:\nHero: BTN AhKs\nPreflop: H r 15, BB c')).board).toEqual([])
  })

  it('Hero is flagged with HERO color and label', () => {
    const hero = buildHandViewModel(parseHand(SAMPLE_RAW)).hero
    expect(hero.isHero).toBe(true)
    expect(hero.color).toBe(HERO_COLOR)
    expect(hero.label).toBe('HERO')
    expect(hero.position).toBe('BTN')
    expect(hero.cards).toEqual(['Ah', 'Ks'])
  })

  it('street view-models have correct names', () => {
    expect(buildHandViewModel(parseHand(SAMPLE_RAW)).streets.map((s) => s.name)).toEqual(['Preflop', 'Flop', 'Turn', 'River'])
  })

  it('actions carry actor, verb, optional amount and isHero', () => {
    const pre = buildHandViewModel(parseHand(SAMPLE_RAW)).streets[0].actions
    expect(pre[0]).toMatchObject({ actor: 'H', verb: 'r', amount: 15, isHero: true })
    expect(pre[1]).toMatchObject({ actor: 'BB', verb: 'c', isHero: false })
    expect(pre[1].amount).toBeUndefined()
  })

  it('POSITION_COLORS covers all non-Hero positions; HERO_COLOR is distinct', () => {
    for (const pos of ['V', 'V2', 'V3', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']) {
      expect((POSITION_COLORS as Record<string, string>)[pos]).toBeDefined()
    }
    expect(Object.values(POSITION_COLORS)).not.toContain(HERO_COLOR)
  })

  it('renders a showdown when present', () => {
    const vm = buildHandViewModel(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: H c\nShowdown: V shows QcJd'))
    expect(vm.showdown).toHaveLength(1)
    expect(vm.showdown![0]).toMatchObject({ actor: 'V', verb: 'shows', cards: ['Qc', 'Jd'] })
  })
})

// ===========================================================================
// buildEditorView
// ===========================================================================

function chipById(raw: string, id: string): Chip | undefined {
  for (const line of buildEditorView(parseHand(raw))) {
    for (const chip of line.chips) if (chip.id === id) return chip
  }
  return undefined
}

describe('buildEditorView — chip ids and text', () => {
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c'

  it('stakes chip carries value and editKind', () => {
    const chip = chipById('[Stakes: 2/5]\n' + raw, 'stakes')
    expect(chip?.text).toBe('2/5')
    expect(chip?.editKind).toBe('stakes')
  })

  it('board card chips are positional with glyph text', () => {
    expect(chipById(raw, 'board:0')?.text).toBe('A♠')
    expect(chipById(raw, 'board:1')?.text).toBe('8♥')
    expect(chipById(raw, 'board:2')?.text).toBe('T♦')
    expect(chipById(raw, 'board:0')?.editKind).toBe('board-card')
  })

  it('board:add chip appears below 5 cards, not at 5', () => {
    expect(chipById(raw, 'board:add')).toBeDefined()
    expect(chipById('Board: As 8h Td Jc 2s\nHero: BTN AhKs\nPreflop: H x', 'board:add')).toBeUndefined()
  })

  it('empty board shows a "No board" label and an add chip', () => {
    const line = buildEditorView(parseHand('Board:\nHero: BTN AhKs\nPreflop: H x')).find((l) => l.key === 'board:empty')!
    expect(line.chips[0].text).toBe('No board')
    expect(line.chips.some((c) => c.id === 'board:add')).toBe(true)
  })

  it('hero position and packed cards become chips', () => {
    expect(chipById(raw, 'hero:pos')?.text).toBe('BTN')
    expect(chipById(raw, 'hero:card:0')?.text).toBe('A♥')
    expect(chipById(raw, 'hero:card:1')?.text).toBe('K♠')
  })

  it('action chips carry actor and verb (with amount)', () => {
    expect(chipById(raw, 'action:Preflop:0:actor')?.text).toBe('H')
    expect(chipById(raw, 'action:Preflop:0:verb')?.text).toBe('Raise 15')
    expect(chipById(raw, 'action:Preflop:1:actor')?.text).toBe('BB')
    expect(chipById(raw, 'action:Preflop:1:verb')?.text).toBe('Call')
  })

  it('all-in verb chips render with and without amount', () => {
    expect(chipById('Board: As 8h Td\nHero: BTN AhKs\nPreflop: H all in 200', 'action:Preflop:0:verb')?.text).toBe('All In 200')
    expect(chipById('Board: As 8h Td\nHero: BTN AhKs\nPreflop: H all in, BB c', 'action:Preflop:0:verb')?.text).toBe('All In')
  })

  it('showdown chips are positional', () => {
    const sd = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: H x\nShowdown: H shows QcJd'
    expect(chipById(sd, 'showdown:0:actor')?.text).toBe('H')
    expect(chipById(sd, 'showdown:0:verb')?.text).toBe('Shows')
    expect(chipById(sd, 'showdown:0:card:0')?.text).toBe('Q♣')
    expect(chipById(sd, 'showdown:0:card:1')?.text).toBe('J♦')
  })

  it('notes render as positional note chips', () => {
    expect(chipById('Board: As 8h Td\n# read\nHero: BTN AhKs\nPreflop: H x', 'note:0')?.text).toBe('# read')
  })

  it('chip ids are stable across calls', () => {
    const ids1 = buildEditorView(parseHand(raw)).flatMap((l) => l.chips.map((c) => c.id))
    const ids2 = buildEditorView(parseHand(raw)).flatMap((l) => l.chips.map((c) => c.id))
    expect(ids1).toEqual(ids2)
  })
})
