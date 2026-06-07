import type { Span } from './types'
import { isLastActionABet, collectCardCodes, allCardCodes } from './suggestions'
import { SUIT_GLYPHS } from './cards'

export type ChipKind =
  | 'stakes'
  | 'board-card'
  | 'hero-pos'
  | 'hero-card'
  | 'action-actor'
  | 'action-verb'
  | 'showdown-actor'
  | 'showdown-verb'
  | 'showdown-card'
  | 'note'
  | 'label'

export type EditKind =
  | 'board-card'
  | 'hero-pos'
  | 'hero-card'
  | 'actor'
  | 'verb'
  | 'showdown-actor'
  | 'showdown-verb'
  | 'showdown-card'
  | 'stakes'
  | null

export interface ChipMeta {
  cardCode?: string
  verb?: string
  amount?: number
  facingBet?: boolean
  street?: string
  actor?: string
}

export interface Chip {
  id: string
  kind: ChipKind
  text: string
  span: Span | null
  editKind: EditKind
  meta?: ChipMeta
}

export interface ChipLine {
  key: string
  chips: Chip[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VERB_LABELS: Record<string, string> = {
  x: 'Check', c: 'Call', r: 'Raise', f: 'Fold', b: 'Bet', a: 'All In', 'all in': 'All In',
}

const SHOWDOWN_VERB_LABELS: Record<string, string> = {
  shows: 'Shows', wins: 'Wins', loses: 'Loses',
}

function formatCardText(code: string): string {
  if (code.length !== 2) return code
  const rank = code[0]
  const suitCode = code[1]
  const glyph = SUIT_GLYPHS[suitCode as keyof typeof SUIT_GLYPHS] ?? suitCode
  return rank + glyph
}

function label(key: string, text: string): ChipLine {
  return { key, chips: [{ id: key, kind: 'label', text, span: null, editKind: null }] }
}

// ---------------------------------------------------------------------------
// Offset-preserving line table (mirrors parser.ts buildState)
// ---------------------------------------------------------------------------

interface LineEntry {
  text: string
  start: number
}

function buildLineTable(raw: string): LineEntry[] {
  const lines: LineEntry[] = []
  let pos = 0
  for (const text of raw.split('\n')) {
    lines.push({ text, start: pos })
    pos += text.length + 1
  }
  return lines
}

// ---------------------------------------------------------------------------
// Per-line tokenizers
// ---------------------------------------------------------------------------

function tokenizeStakes(line: string, lineStart: number): Chip | null {
  const match = /^\[Stakes:(.*)\]$/.exec(line.trim())
  if (!match) return null
  const innerText = match[1]
  const trimmedValue = innerText.trim()
  if (!trimmedValue) return null
  const innerLocalIdx = line.indexOf(match[1])
  const leadingSpaces = innerText.length - innerText.trimStart().length
  const absStart = lineStart + innerLocalIdx + leadingSpaces
  const absEnd = absStart + trimmedValue.length
  return {
    id: 'stakes',
    kind: 'stakes',
    text: trimmedValue,
    span: { start: absStart, end: absEnd },
    editKind: 'stakes',
  }
}

function tokenizeBoardCards(line: string, lineStart: number): Chip[] {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return []
  const afterColon = line.slice(colonIdx + 1)
  const afterColonOffset = lineStart + colonIdx + 1
  const chips: Chip[] = []
  let i = 0
  let cardIdx = 0
  while (i < afterColon.length) {
    if (/\s/.test(afterColon[i])) { i++; continue }
    if (i + 1 >= afterColon.length) break
    const code = afterColon[i] + afterColon[i + 1]
    const absStart = afterColonOffset + i
    chips.push({
      id: `board:${cardIdx}`,
      kind: 'board-card',
      text: formatCardText(code),
      span: { start: absStart, end: absStart + 2 },
      editKind: 'board-card',
      meta: { cardCode: code },
    })
    cardIdx++
    i += 2
  }
  return chips
}

function tokenizeHeroLine(line: string, lineStart: number): Chip[] {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return []
  const afterColonRaw = line.slice(colonIdx + 1)
  const afterColon = afterColonRaw.trim()
  const trimLeading = afterColonRaw.length - afterColonRaw.trimStart().length
  const afterColonTrimOffset = lineStart + colonIdx + 1 + trimLeading

  if (!afterColon) return []

  const chips: Chip[] = []
  const spaceIdx = afterColon.search(/\s/)
  const posStr = spaceIdx === -1 ? afterColon : afterColon.slice(0, spaceIdx)

  if (posStr) {
    const posAbsStart = afterColonTrimOffset
    chips.push({
      id: 'hero:pos',
      kind: 'hero-pos',
      text: posStr,
      span: { start: posAbsStart, end: posAbsStart + posStr.length },
      editKind: 'hero-pos',
      meta: { actor: posStr },
    })
  }

  // Packed cards after position (may have leading whitespace)
  if (spaceIdx !== -1) {
    const cardsRaw = afterColon.slice(spaceIdx)
    const cardsLeading = cardsRaw.length - cardsRaw.trimStart().length
    const cardsText = cardsRaw.trim()
    const cardsOffset = afterColonTrimOffset + spaceIdx + cardsLeading
    let i = 0
    let cardIdx = 0
    while (i < cardsText.length) {
      if (/\s/.test(cardsText[i])) { i++; continue }
      if (i + 1 >= cardsText.length) break
      const code = cardsText[i] + cardsText[i + 1]
      const absStart = cardsOffset + i
      chips.push({
        id: `hero:card:${cardIdx}`,
        kind: 'hero-card',
        text: formatCardText(code),
        span: { start: absStart, end: absStart + 2 },
        editKind: 'hero-card',
        meta: { cardCode: code },
      })
      cardIdx++
      i += 2
    }
  }

  return chips
}

function tokenizeStreetLine(
  line: string,
  lineStart: number,
  streetName: string,
): Chip[] {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return []
  const afterColon = line.slice(colonIdx + 1)
  const chips: Chip[] = []
  let searchFrom = 0
  let actionIdx = 0

  for (const segment of afterColon.split(',')) {
    const localIdx = afterColon.indexOf(segment, searchFrom)
    const segAbsStart = lineStart + colonIdx + 1 + localIdx
    const trimmed = segment.trim()
    searchFrom = localIdx + segment.length

    if (!trimmed) continue

    const trimOffset = segAbsStart + (segment.length - segment.trimStart().length)
    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length === 0) continue

    const actorStr = parts[0]
    const actorLocalIdx = trimmed.indexOf(actorStr)
    const actorAbsStart = trimOffset + actorLocalIdx

    chips.push({
      id: `action:${streetName}:${actionIdx}:actor`,
      kind: 'action-actor',
      text: actorStr,
      span: { start: actorAbsStart, end: actorAbsStart + actorStr.length },
      editKind: 'actor',
      meta: { street: streetName, actor: actorStr },
    })

    if (parts.length >= 2) {
      // Compute facing-bet from the already-completed segments before this one
      const priorSegments = afterColon
        .split(',')
        .slice(0, actionIdx)
        .map((s) => s.trim())
        .filter(Boolean)
      const facingBet = isLastActionABet(priorSegments)

      // Verb: handle "all in" two-word
      let verbInternal: string
      let verbAbsEnd: number
      let amount: number | undefined

      const verbWordRelIdx = trimmed.indexOf(parts[1], actorLocalIdx + actorStr.length)
      const verbAbsStart2 = trimOffset + verbWordRelIdx

      if (parts[1] === 'all' && parts.length >= 3 && parts[2] === 'in') {
        verbInternal = 'a'
        const inIdx = trimmed.indexOf('in', verbWordRelIdx + 3)
        verbAbsEnd = trimOffset + inIdx + 2

        if (parts.length >= 4) {
          const amtStr = parts[3]
          const amtVal = Number(amtStr)
          if (Number.isFinite(amtVal)) {
            amount = amtVal
            const amtLocalIdx = trimmed.indexOf(amtStr, inIdx + 2)
            verbAbsEnd = trimOffset + amtLocalIdx + amtStr.length
          }
        }
      } else {
        verbInternal = parts[1]
        verbAbsEnd = verbAbsStart2 + parts[1].length

        if ((verbInternal === 'r' || verbInternal === 'b') && parts.length >= 3) {
          const amtStr = parts[2]
          const amtVal = Number(amtStr)
          if (Number.isFinite(amtVal)) {
            amount = amtVal
            const amtLocalIdx = trimmed.indexOf(amtStr, verbWordRelIdx + parts[1].length)
            verbAbsEnd = trimOffset + amtLocalIdx + amtStr.length
          }
        } else if (verbInternal === 'a' && parts.length >= 3) {
          const amtStr = parts[2]
          const amtVal = Number(amtStr)
          if (Number.isFinite(amtVal)) {
            amount = amtVal
            const amtLocalIdx = trimmed.indexOf(amtStr, verbWordRelIdx + parts[1].length)
            verbAbsEnd = trimOffset + amtLocalIdx + amtStr.length
          }
        }
      }

      // Don't emit a verb chip if the verb requires a mandatory amount and none is present
      // (the wizard is still awaiting the amount — it owns that token)
      const needsMandatoryAmount = verbInternal === 'r' || verbInternal === 'b'
      if (needsMandatoryAmount && amount === undefined) {
        actionIdx++
        continue
      }

      const verbLabel = VERB_LABELS[verbInternal] ?? verbInternal
      const verbText = amount !== undefined
        ? verbInternal === 'a'
          ? `All In ${amount}`
          : `${verbLabel} ${amount}`
        : verbLabel

      chips.push({
        id: `action:${streetName}:${actionIdx}:verb`,
        kind: 'action-verb',
        text: verbText,
        span: { start: verbAbsStart2, end: verbAbsEnd },
        editKind: 'verb',
        meta: { verb: verbInternal, amount, facingBet, street: streetName, actor: actorStr },
      })
    }

    actionIdx++
  }

  return chips
}

function tokenizeShowdownLine(line: string, lineStart: number): Chip[] {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return []
  const afterColon = line.slice(colonIdx + 1)
  const chips: Chip[] = []
  let searchFrom = 0
  let actionIdx = 0

  for (const segment of afterColon.split(',')) {
    const localIdx = afterColon.indexOf(segment, searchFrom)
    const segAbsStart = lineStart + colonIdx + 1 + localIdx
    const trimmed = segment.trim()
    searchFrom = localIdx + segment.length

    if (!trimmed) continue

    const trimOffset = segAbsStart + (segment.length - segment.trimStart().length)
    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length === 0) continue

    const actorStr = parts[0]
    const actorLocalIdx = trimmed.indexOf(actorStr)
    const actorAbsStart = trimOffset + actorLocalIdx
    chips.push({
      id: `showdown:${actionIdx}:actor`,
      kind: 'showdown-actor',
      text: actorStr,
      span: { start: actorAbsStart, end: actorAbsStart + actorStr.length },
      editKind: 'showdown-actor',
      meta: { actor: actorStr },
    })

    if (parts.length >= 2) {
      const verbStr = parts[1]
      const verbLocalIdx = trimmed.indexOf(verbStr, actorLocalIdx + actorStr.length)
      const verbAbsStart = trimOffset + verbLocalIdx
      const verbAbsEnd = verbAbsStart + verbStr.length

      chips.push({
        id: `showdown:${actionIdx}:verb`,
        kind: 'showdown-verb',
        text: SHOWDOWN_VERB_LABELS[verbStr] ?? verbStr,
        span: { start: verbAbsStart, end: verbAbsEnd },
        editKind: 'showdown-verb',
        meta: { verb: verbStr, actor: actorStr },
      })

      if (verbStr === 'shows' && parts.length >= 3) {
        // Packed cards after "shows"
        const afterVerb = trimmed.slice(verbLocalIdx + verbStr.length)
        const afterVerbLeading = afterVerb.length - afterVerb.trimStart().length
        const cardsText = afterVerb.trim()
        const cardsOffset = trimOffset + verbLocalIdx + verbStr.length + afterVerbLeading
        let i = 0
        let cardIdx = 0
        while (i < cardsText.length) {
          if (/\s/.test(cardsText[i])) { i++; continue }
          if (i + 1 >= cardsText.length) break
          const code = cardsText[i] + cardsText[i + 1]
          const absStart = cardsOffset + i
          chips.push({
            id: `showdown:${actionIdx}:card:${cardIdx}`,
            kind: 'showdown-card',
            text: formatCardText(code),
            span: { start: absStart, end: absStart + 2 },
            editKind: 'showdown-card',
            meta: { cardCode: code, actor: actorStr },
          })
          cardIdx++
          i += 2
        }
      }
    }

    actionIdx++
  }

  return chips
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

export function buildRecordingView(raw: string): ChipLine[] {
  const result: ChipLine[] = []
  if (!raw.trim()) return result

  const lines = buildLineTable(raw)
  let noteIdx = 0

  for (const { text, start } of lines) {
    const trimmed = text.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('#')) {
      const noteText = trimmed.slice(1).trim()
      result.push({
        key: `note:${noteIdx}`,
        chips: [{
          id: `note:${noteIdx}`,
          kind: 'note',
          text: `# ${noteText}`,
          span: null,
          editKind: null,
        }],
      })
      noteIdx++
    } else if (trimmed.startsWith('[Stakes:')) {
      const chip = tokenizeStakes(text, start)
      if (chip) {
        result.push({ key: 'stakes', chips: [chip] })
      }
    } else if (trimmed.startsWith('Board:')) {
      const cards = tokenizeBoardCards(text, start)
      if (cards.length === 0) {
        result.push(label('board:empty', 'No board'))
      } else {
        result.push({ key: 'board', chips: cards })
      }
    } else if (trimmed.startsWith('Hero:')) {
      const chips = tokenizeHeroLine(text, start)
      if (chips.length > 0) {
        result.push({ key: 'hero', chips })
      }
    } else if (trimmed.startsWith('Showdown:')) {
      const chips = tokenizeShowdownLine(text, start)
      if (chips.length > 0) {
        result.push({ key: 'showdown', chips })
      }
    } else {
      // Street line (Preflop/Flop/Turn/River)
      const streetMatch = /^(Preflop|Flop|Turn|River):/.exec(trimmed)
      if (streetMatch) {
        const streetName = streetMatch[1]
        const chips = tokenizeStreetLine(text, start, streetName)
        if (chips.length > 0) {
          result.push({ key: `street:${streetName}`, chips })
        }
      }
    }
  }

  return result
}

export function applyChipEdit(raw: string, span: Span, newText: string): string {
  return raw.slice(0, span.start) + newText + raw.slice(span.end)
}

export function usedCardsExcept(raw: string, keepSpan: Span): Set<string> {
  const allUsed = collectCardCodes(raw)
  // Remove the card being edited from the used set so it stays selectable
  const editedCode = raw.slice(keepSpan.start, keepSpan.end)
  allUsed.delete(editedCode)
  return allUsed
}

export { allCardCodes }
