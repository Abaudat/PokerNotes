import { describe } from 'vitest'
import { InMemoryRepository } from './inMemoryRepository'
import { runRepositoryContract } from './repositoryContract'

describe('InMemoryRepository', () => {
  runRepositoryContract(() => new InMemoryRepository())
})
