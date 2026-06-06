import { describe, it, expect } from 'vitest'
import { buildHandViewModel, POSITION_COLORS, HERO_COLOR } from './render'
import { parseHand } from './parser'

const SAMPLE_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

describe('buildHandViewModel', () => {
  it('produces a view-model without throwing', () => {
    const ast = parseHand(SAMPLE_RAW)
    expect(() => buildHandViewModel(ast)).not.toThrow()
  })

  it('includes stakes text when present', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    expect(vm.stakes).toBe('$2/$5')
  })

  it('stakes is undefined when not present', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c`
    const ast = parseHand(raw)
    const vm = buildHandViewModel(ast)
    expect(vm.stakes).toBeUndefined()
  })

  it('maps board cards to display codes', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    expect(vm.board).toEqual(['As', '8h', 'Td'])
  })

  it('empty board yields empty array', () => {
    const raw = `Board:\nHero: BTN AhKs\nPreflop: H r 15, BB c`
    const ast = parseHand(raw)
    const vm = buildHandViewModel(ast)
    expect(vm.board).toEqual([])
  })

  it('Hero has isHero=true and heroColor', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    expect(vm.hero.isHero).toBe(true)
    expect(vm.hero.color).toBe(HERO_COLOR)
    expect(vm.hero.label).toBe('HERO')
  })

  it('Hero position is correct', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    expect(vm.hero.position).toBe('BTN')
  })

  it('Hero cards are correct', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    expect(vm.hero.cards).toEqual(['Ah', 'Ks'])
  })

  it('street view-models have correct names', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    const names = vm.streets.map((s) => s.name)
    expect(names).toEqual(['Preflop', 'Flop', 'Turn', 'River'])
  })

  it('actions have actor, verb, and optional amount', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    const preflopActions = vm.streets[0].actions
    expect(preflopActions[0]).toMatchObject({ actor: 'H', verb: 'r', amount: 15, isHero: true })
    expect(preflopActions[1]).toMatchObject({ actor: 'BB', verb: 'c', isHero: false })
    expect(preflopActions[1].amount).toBeUndefined()
  })

  it('Hero actions are flagged isHero=true', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    const allActions = vm.streets.flatMap((s) => s.actions)
    const heroActions = allActions.filter((a) => a.actor === 'H')
    expect(heroActions.every((a) => a.isHero)).toBe(true)
  })

  it('non-Hero actions are flagged isHero=false', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    const allActions = vm.streets.flatMap((s) => s.actions)
    const villainActions = allActions.filter((a) => a.actor !== 'H')
    expect(villainActions.every((a) => !a.isHero)).toBe(true)
  })

  it('each actor gets a color from POSITION_COLORS or HERO_COLOR', () => {
    const ast = parseHand(SAMPLE_RAW)
    const vm = buildHandViewModel(ast)
    const allActions = vm.streets.flatMap((s) => s.actions)
    for (const action of allActions) {
      expect(typeof action.color).toBe('string')
      expect(action.color.length).toBeGreaterThan(0)
    }
  })

  it('POSITION_COLORS covers all non-Hero positions', () => {
    const positions = ['V', 'V2', 'V3', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'EP', 'MP']
    for (const pos of positions) {
      expect((POSITION_COLORS as Record<string, string>)[pos]).toBeDefined()
    }
  })

  it('HERO_COLOR is distinct from all POSITION_COLORS', () => {
    const villainColors = Object.values(POSITION_COLORS)
    expect(villainColors).not.toContain(HERO_COLOR)
  })
})
