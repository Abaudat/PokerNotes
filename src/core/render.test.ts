import { describe, it, expect } from 'vitest'
import { buildHandViewModel, buildEditorView, POSITION_COLORS, HERO_COLOR } from './render'
import { parseHand } from './parser'
import type { Chip } from './render'

// Hero is BTN, heads-up against BB by the flop → BTN marked H, BB marked V.
const SAMPLE_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: BTN r 15, BB c
Flop: BB x, BTN b 20, BB c
Turn: BB x, BTN x
River: BB b 40, BTN f`

// ===========================================================================
// buildHandViewModel
// ===========================================================================

describe('buildHandViewModel', () => {
  it('includes stakes text when present', () => {
    expect(buildHandViewModel(parseHand(SAMPLE_RAW)).stakes).toBe('$2/$5')
  })

  it('stakes is undefined when not present', () => {
    expect(buildHandViewModel(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15, BB c')).stakes).toBeUndefined()
  })

  it('maps board cards to display codes', () => {
    expect(buildHandViewModel(parseHand(SAMPLE_RAW)).board).toEqual(['As', '8h', 'Td'])
  })

  it('empty board yields empty array', () => {
    expect(buildHandViewModel(parseHand('Board:\nHero: BTN AhKs\nPreflop: BTN r 15, BB c')).board).toEqual([])
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
    expect(pre[0]).toMatchObject({ actor: 'BTN', verb: 'r', amount: 15, isHero: true })
    expect(pre[1]).toMatchObject({ actor: 'BB', verb: 'c', isHero: false })
    expect(pre[1].amount).toBeUndefined()
  })

  it('marks the hero seat with an "H (pos)" label', () => {
    const pre = buildHandViewModel(parseHand(SAMPLE_RAW)).streets[0].actions
    expect(pre[0].marker).toBe('H')
    expect(pre[0].label).toBe('H (BTN)')
    expect(pre[0].color).toBe(HERO_COLOR)
  })

  it('marks the lone villain seat with a "V (pos)" label, retroactively preflop', () => {
    const pre = buildHandViewModel(parseHand(SAMPLE_RAW)).streets[0].actions
    expect(pre[1].marker).toBe('V')
    expect(pre[1].isVillain).toBe(true)
    expect(pre[1].label).toBe('V (BB)')
  })

  it('does not mark a villain when the flop is multiway', () => {
    // Three players see the flop → no single villain.
    const vm = buildHandViewModel(
      parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: CO c, BTN c, BB x\nFlop: BB x, CO x, BTN x'),
    )
    const labels = vm.streets[0].actions.map((a) => a.label)
    expect(labels).toContain('H (BTN)')
    expect(labels).toContain('CO')
    expect(labels).toContain('BB')
    expect(vm.streets[0].actions.every((a) => a.marker !== 'V')).toBe(true)
  })

  it('POSITION_COLORS covers all real positions; HERO_COLOR is distinct', () => {
    for (const pos of ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']) {
      expect((POSITION_COLORS as Record<string, string>)[pos]).toBeDefined()
    }
    expect(Object.values(POSITION_COLORS)).not.toContain(HERO_COLOR)
  })

  it('renders a showdown when present, marking hero/villain', () => {
    const vm = buildHandViewModel(parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN c, BB x\nShowdown: BB shows QcJd'))
    expect(vm.showdown).toHaveLength(1)
    expect(vm.showdown![0]).toMatchObject({ actor: 'BB', verb: 'shows', cards: ['Qc', 'Jd'], marker: 'V', label: 'V (BB)' })
  })

  it('exposes notes with their anchors', () => {
    const vm = buildHandViewModel(
      parseHand('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15, BB c\n# villain seemed weak\nFlop: BB x, BTN x\n# checked back'),
    )
    expect(vm.notes).toHaveLength(2)
    expect(vm.notes[0]).toMatchObject({ text: 'villain seemed weak', anchor: 'Preflop' })
    expect(vm.notes[1]).toMatchObject({ text: 'checked back', anchor: 'Flop' })
  })

  it('notes is empty when the hand has none', () => {
    expect(buildHandViewModel(parseHand(SAMPLE_RAW)).notes).toEqual([])
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
  const raw = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN r 15, BB c'

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
    expect(chipById('Board: As 8h Td Jc 2s\nHero: BTN AhKs\nPreflop: BTN x', 'board:add')).toBeUndefined()
  })

  it('empty board shows a "No board" label and an add chip', () => {
    const line = buildEditorView(parseHand('Board:\nHero: BTN AhKs\nPreflop: BTN x')).find((l) => l.key === 'board:empty')!
    expect(line.chips[0].text).toBe('No board')
    expect(line.chips.some((c) => c.id === 'board:add')).toBe(true)
  })

  it('hero position chip is marked H (pos)', () => {
    expect(chipById(raw, 'hero:pos')?.text).toBe('H (BTN)')
    expect(chipById(raw, 'hero:card:0')?.text).toBe('A♥')
    expect(chipById(raw, 'hero:card:1')?.text).toBe('K♠')
  })

  it('action chips carry the merged actor + verb text', () => {
    expect(chipById(raw, 'action:Preflop:0')?.text).toBe('H (BTN) raises 15')
    expect(chipById(raw, 'action:Preflop:1')?.text).toBe('V (BB) calls')
  })

  it('action chip meta carries the two-tone parts for the UI', () => {
    expect(chipById(raw, 'action:Preflop:0')?.meta).toMatchObject({
      actor: 'BTN',
      marker: 'H',
      verb: 'r',
      amount: 15,
      actorLabel: 'H (BTN)',
      verbText: 'raises 15',
    })
    expect(chipById(raw, 'action:Preflop:1')?.meta).toMatchObject({
      actor: 'BB',
      marker: 'V',
      verb: 'c',
      actorLabel: 'V (BB)',
      verbText: 'calls',
    })
  })

  it('action chip id scheme uses action:street:index (no :actor/:verb suffix)', () => {
    expect(chipById(raw, 'action:Preflop:0:actor')).toBeUndefined()
    expect(chipById(raw, 'action:Preflop:0:verb')).toBeUndefined()
  })

  it('all-in chips render with and without amount', () => {
    expect(chipById('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN all in 200', 'action:Preflop:0')?.text).toBe('H (BTN) all in 200')
    expect(chipById('Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN all in, BB c', 'action:Preflop:0')?.text).toBe('H (BTN) all in')
  })

  it('showdown chips are positional', () => {
    const sd = 'Board: As 8h Td\nHero: BTN AhKs\nPreflop: BTN x\nShowdown: BTN shows QcJd'
    expect(chipById(sd, 'showdown:0:actor')?.text).toBe('H (BTN)')
    expect(chipById(sd, 'showdown:0:verb')?.text).toBe('Shows')
    expect(chipById(sd, 'showdown:0:card:0')?.text).toBe('Q♣')
    expect(chipById(sd, 'showdown:0:card:1')?.text).toBe('J♦')
  })

  it('notes render as positional note chips', () => {
    expect(chipById('Board: As 8h Td\n# read\nHero: BTN AhKs\nPreflop: BTN x', 'note:0')?.text).toBe('# read')
  })

  it('chip ids are stable across calls', () => {
    const ids1 = buildEditorView(parseHand(raw)).flatMap((l) => l.chips.map((c) => c.id))
    const ids2 = buildEditorView(parseHand(raw)).flatMap((l) => l.chips.map((c) => c.id))
    expect(ids1).toEqual(ids2)
  })
})
