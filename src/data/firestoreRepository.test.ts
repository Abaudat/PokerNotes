// @vitest-environment node
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { doc, setDoc, getDoc, collection } from 'firebase/firestore'
import { FirestoreRepository } from './firestoreRepository'
import { runRepositoryContract } from './repositoryContract'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'poker-notes-test'
const UID = 'user-alice'
const OTHER_UID = 'user-bob'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}, 30_000)

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// ── Contract tests ────────────────────────────────────────────────────────────

describe('FirestoreRepository', () => {
  runRepositoryContract(() => {
    const ctx = testEnv.authenticatedContext(UID)
    return new FirestoreRepository(UID, ctx.firestore() as any)
  })
})

// ── Security rules ────────────────────────────────────────────────────────────

describe('Firestore security rules', () => {
  it('allows owner to write and read their own hands', async () => {
    const db = testEnv.authenticatedContext(UID).firestore()
    const ref = doc(collection(db, `users/${UID}/hands`))
    await assertSucceeds(
      setDoc(ref, { raw: 'test', summary: {}, createdAt: new Date(), updatedAt: new Date() }),
    )
    await assertSucceeds(getDoc(ref))
  })

  it('denies another authenticated user from reading the owner hands', async () => {
    let handPath = ''
    await testEnv.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore()
      const ref = doc(collection(db, `users/${UID}/hands`))
      await setDoc(ref, { raw: 'test', summary: {} })
      handPath = ref.path
    })

    const db = testEnv.authenticatedContext(OTHER_UID).firestore()
    await assertFails(getDoc(doc(db, handPath)))
  })

  it('denies unauthenticated access', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, `users/${UID}/hands/some-id`)))
  })

  it('denies another user from writing to the owner collection', async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore()
    const ref = doc(collection(db, `users/${UID}/hands`))
    await assertFails(setDoc(ref, { raw: 'evil', summary: {} }))
  })
})
