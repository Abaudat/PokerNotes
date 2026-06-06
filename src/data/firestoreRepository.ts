import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import type { Firestore, Timestamp } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './firebase'
import { summaryFromRaw } from './summaryFromRaw'
import type { HandRepository, ListedHand, StoredHand } from './repository'

function toDate(ts: Timestamp | Date | null | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

export class FirestoreRepository implements HandRepository {
  private db: Firestore
  private collectionPath: string

  constructor(uid: string, db?: Firestore) {
    this.db = db ?? getFirestore(getFirebaseApp())
    this.collectionPath = `users/${uid}/hands`
  }

  private col() {
    return collection(this.db, this.collectionPath)
  }

  async save(raw: string): Promise<string> {
    const ref = await addDoc(this.col(), {
      raw,
      summary: summaryFromRaw(raw),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async get(id: string): Promise<StoredHand | null> {
    const snap = await getDoc(doc(this.db, this.collectionPath, id))
    if (!snap.exists()) return null
    const d = snap.data()
    return {
      id: snap.id,
      raw: d.raw,
      summary: d.summary,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    }
  }

  async list(): Promise<ListedHand[]> {
    const snap = await getDocs(query(this.col(), orderBy('createdAt', 'desc')))
    return snap.docs.map(d => ({
      id: d.id,
      summary: d.data().summary,
      createdAt: toDate(d.data().createdAt),
    }))
  }

  subscribe(callback: (hands: ListedHand[]) => void): () => void {
    return onSnapshot(query(this.col(), orderBy('createdAt', 'desc')), snap => {
      callback(snap.docs.map(d => ({
        id: d.id,
        summary: d.data().summary,
        createdAt: toDate(d.data().createdAt),
      })))
    })
  }

  async update(id: string, raw: string): Promise<void> {
    await updateDoc(doc(this.db, this.collectionPath, id), {
      raw,
      summary: summaryFromRaw(raw),
      updatedAt: serverTimestamp(),
    })
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.db, this.collectionPath, id))
  }
}
