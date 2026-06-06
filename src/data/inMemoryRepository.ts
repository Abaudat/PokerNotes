import { summaryFromRaw } from './summaryFromRaw'
import type { HandRepository, ListedHand, StoredHand } from './repository'

export class InMemoryRepository implements HandRepository {
  private hands = new Map<string, StoredHand>()
  private subscribers = new Set<(hands: ListedHand[]) => void>()

  async save(raw: string): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date()
    this.hands.set(id, { id, raw, summary: summaryFromRaw(raw), createdAt: now, updatedAt: now })
    this.notifySubscribers()
    return id
  }

  async get(id: string): Promise<StoredHand | null> {
    return this.hands.get(id) ?? null
  }

  async list(): Promise<ListedHand[]> {
    return this.sortedList()
  }

  subscribe(callback: (hands: ListedHand[]) => void): () => void {
    this.subscribers.add(callback)
    callback(this.sortedList())
    return () => this.subscribers.delete(callback)
  }

  async update(id: string, raw: string): Promise<void> {
    const existing = this.hands.get(id)
    if (!existing) throw new Error(`Hand ${id} not found`)
    this.hands.set(id, { ...existing, raw, summary: summaryFromRaw(raw), updatedAt: new Date() })
    this.notifySubscribers()
  }

  async delete(id: string): Promise<void> {
    this.hands.delete(id)
    this.notifySubscribers()
  }

  private sortedList(): ListedHand[] {
    return [...this.hands.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ id, summary, createdAt }) => ({ id, summary, createdAt }))
  }

  private notifySubscribers(): void {
    const hands = this.sortedList()
    for (const cb of this.subscribers) cb(hands)
  }
}
