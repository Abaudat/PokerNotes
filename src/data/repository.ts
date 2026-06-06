export interface HandSummary {
  board: string[]
  heroCards: string
  heroPosition: string
  streetReached: string
  stakes?: string
}

export interface ListedHand {
  id: string
  summary: HandSummary
  createdAt: Date
}

export interface StoredHand {
  id: string
  raw: string
  summary: HandSummary
  createdAt: Date
  updatedAt: Date
}

export interface HandRepository {
  save(raw: string): Promise<string>
  get(id: string): Promise<StoredHand | null>
  list(): Promise<ListedHand[]>
  /** Calls callback immediately with current list, then on every change. Returns unsubscribe fn. */
  subscribe(callback: (hands: ListedHand[]) => void): () => void
  update(id: string, raw: string): Promise<void>
  delete(id: string): Promise<void>
}
