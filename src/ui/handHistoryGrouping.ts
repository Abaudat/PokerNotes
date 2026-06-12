import type { ListedHand } from '../data/repository'

export interface HandGroup {
  label: string
  hands: ListedHand[]
}

const MS_PER_DAY = 86_400_000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function dateGroupLabel(date: Date, now: Date = new Date()): string {
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / MS_PER_DAY)
  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Groups consecutive hands by calendar day. Expects hands sorted newest-first. */
export function groupHandsByDate(hands: ListedHand[], now: Date = new Date()): HandGroup[] {
  const groups: HandGroup[] = []
  let currentDay: number | undefined
  for (const hand of hands) {
    const day = startOfDay(hand.createdAt)
    if (day !== currentDay) {
      currentDay = day
      groups.push({ label: dateGroupLabel(hand.createdAt, now), hands: [] })
    }
    groups[groups.length - 1].hands.push(hand)
  }
  return groups
}
