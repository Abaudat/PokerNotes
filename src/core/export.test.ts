import { describe, it, expect } from 'vitest'
import { formatForExport } from './export'
import { parseHand } from './parser'

const SAMPLE_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c
Turn: BB x, H x
River: BB b 40, H f`

describe('formatForExport', () => {
  it('produces a non-empty string', () => {
    const ast = parseHand(SAMPLE_RAW)
    expect(formatForExport(ast)).toBeTruthy()
  })

  it('includes suit glyphs for board cards', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('A♠')
    expect(output).toContain('8♥')
    expect(output).toContain('T♦')
  })

  it('includes suit glyphs for Hero cards', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('A♥')
    expect(output).toContain('K♠')
  })

  it('includes stakes in header', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('$2/$5')
  })

  it('includes Hero position in parentheses', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('Hero (BTN)')
  })

  it('uses full verb words — raises', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('raises')
  })

  it('uses full verb words — calls', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('calls')
  })

  it('uses full verb words — checks', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('checks')
  })

  it('uses full verb words — bets', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('bets')
  })

  it('uses full verb words — folds', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('folds')
  })

  it('includes amount with $ sign for bet/raise', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('$15')
    expect(output).toContain('$20')
    expect(output).toContain('$40')
  })

  it('includes all street names', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('Preflop:')
    expect(output).toContain('Flop:')
    expect(output).toContain('Turn:')
    expect(output).toContain('River:')
  })

  it('identifies Hero actor as "Hero" in action lines', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('Hero raises $15')
  })

  it('identifies BB actor by position name', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    expect(output).toContain('BB calls')
  })

  it('matches the SPEC example output format', () => {
    const ast = parseHand(SAMPLE_RAW)
    const output = formatForExport(ast)
    const lines = output.split('\n')
    expect(lines[0]).toMatch(/\$2\/\$5/)
    expect(lines[1]).toBe('Board: A♠ 8♥ T♦')
    expect(lines[2]).toBe('Hero (BTN): A♥ K♠')
    expect(lines[3]).toBe('Preflop: Hero raises $15, BB calls')
    expect(lines[4]).toBe('Flop: BB checks, Hero bets $20, BB calls')
    expect(lines[5]).toBe('Turn: BB checks, Hero checks')
    expect(lines[6]).toBe('River: BB bets $40, Hero folds')
  })

  it('works without stakes', () => {
    const raw = `Board: As 8h Td\nHero: BTN AhKs\nPreflop: H r 15, BB c`
    const ast = parseHand(raw)
    const output = formatForExport(ast)
    expect(output).toContain('Board:')
    expect(output).not.toContain('undefined')
  })

  it('works with empty board', () => {
    const raw = `Board:\nHero: BTN AhKs\nPreflop: H r 15, BB f`
    const ast = parseHand(raw)
    const output = formatForExport(ast)
    expect(output).toContain('Board:')
  })
})
