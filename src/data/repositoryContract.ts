import { beforeEach, it, expect, describe } from 'vitest'
import type { HandRepository, ListedHand } from './repository'

const SAMPLE_RAW = `[Stakes: $2/$5]
Board: As 8h Td
Hero: BTN AhKs
Preflop: H r 15, BB c
Flop: BB x, H b 20, BB c`

const SAMPLE_RAW_2 = `Board: Kd Qh Jc
Hero: CO 7s7d
Preflop: H r 12, BB c
Flop: BB x, H b 30, BB f`

export function runRepositoryContract(makeRepo: () => HandRepository): void {
  let repo: HandRepository

  beforeEach(() => {
    repo = makeRepo()
  })

  it('save returns an id; get retrieves the hand with correct summary', async () => {
    const id = await repo.save(SAMPLE_RAW)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const hand = await repo.get(id)
    expect(hand).not.toBeNull()
    expect(hand!.id).toBe(id)
    expect(hand!.raw).toBe(SAMPLE_RAW)
    expect(hand!.summary.heroPosition).toBe('BTN')
    expect(hand!.summary.heroCards).toBe('AhKs')
    expect(hand!.summary.board).toEqual(['As', '8h', 'Td'])
    expect(hand!.summary.streetReached).toBe('Flop')
    expect(hand!.summary.stakes).toBe('$2/$5')
    expect(typeof hand!.summary.totalPot).toBe('number')
    expect(hand!.summary.totalPot).toBeGreaterThan(0)
    expect(hand!.createdAt).toBeInstanceOf(Date)
    expect(hand!.updatedAt).toBeInstanceOf(Date)
  })

  it('get returns null for an unknown id', async () => {
    expect(await repo.get('no-such-id')).toBeNull()
  })

  it('list returns saved hands newest first', async () => {
    const id1 = await repo.save(SAMPLE_RAW)
    // small delay so createdAt differs in InMemory (same Date.now() bucket otherwise)
    await new Promise(r => setTimeout(r, 5))
    const id2 = await repo.save(SAMPLE_RAW_2)
    const hands = await repo.list()
    const ids = hands.map(h => h.id)
    expect(ids.indexOf(id2)).toBeLessThan(ids.indexOf(id1))
  })

  it('update changes raw and recomputes summary', async () => {
    const id = await repo.save(SAMPLE_RAW)
    await repo.update(id, SAMPLE_RAW_2)
    const hand = await repo.get(id)
    expect(hand!.raw).toBe(SAMPLE_RAW_2)
    expect(hand!.summary.heroPosition).toBe('CO')
    expect(hand!.summary.heroCards).toBe('7s7d')
  })

  it('delete removes the hand from get and list', async () => {
    const id = await repo.save(SAMPLE_RAW)
    await repo.delete(id)
    expect(await repo.get(id)).toBeNull()
    const hands = await repo.list()
    expect(hands.find(h => h.id === id)).toBeUndefined()
  })

  describe('subscribe', () => {
    it('fires callback with saved hand within 5 seconds', async () => {
      let latest: ListedHand[] = []
      const unsub = repo.subscribe(h => { latest = h })

      const id = await repo.save(SAMPLE_RAW)

      const deadline = Date.now() + 5000
      while (!latest.some(h => h.id === id) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 30))
      }

      expect(latest.some(h => h.id === id)).toBe(true)
      unsub()
    }, 10_000)

    it('unsubscribe stops further notifications', async () => {
      let callCount = 0
      const unsub = repo.subscribe(() => { callCount++ })
      unsub()
      const countAfterUnsub = callCount
      await repo.save(SAMPLE_RAW)
      await new Promise(r => setTimeout(r, 60))
      expect(callCount).toBe(countAfterUnsub)
    })
  })
}
