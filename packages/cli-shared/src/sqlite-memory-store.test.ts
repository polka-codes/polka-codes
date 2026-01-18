import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import type { MemoryConfig, MemoryEntry } from '@polka-codes/core'
import { SQLiteMemoryStore } from './sqlite-memory-store'

const TEST_DB_PATH = '/tmp/test-memory.sqlite'

describe('SQLiteMemoryStore', () => {
  let store: SQLiteMemoryStore
  const config: MemoryConfig = {
    enabled: true,
    type: 'sqlite',
    path: TEST_DB_PATH,
  }

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH)
    }
    store = new SQLiteMemoryStore(config, '/tmp/test-project')
  })

  afterEach(() => {
    store.close()
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH)
    }
  })

  describe('CRUD Operations', () => {
    it('should create and read memory entry', async () => {
      await store.updateMemory('replace', 'test-entry', 'Test content', {
        entry_type: 'note',
      })

      const content = await store.readMemory('test-entry')
      expect(content).toBe('Test content')
    })

    it('should update existing entry', async () => {
      await store.updateMemory('replace', 'test-entry', 'Original content', {
        entry_type: 'note',
      })

      await store.updateMemory('replace', 'test-entry', 'Updated content', {
        entry_type: 'note',
      })

      const content = await store.readMemory('test-entry')
      expect(content).toBe('Updated content')
    })

    it('should append to existing entry', async () => {
      await store.updateMemory('replace', 'test-entry', 'Line 1', {
        entry_type: 'note',
      })

      await store.updateMemory('append', 'test-entry', 'Line 2', {
        entry_type: 'note',
      })

      const content = await store.readMemory('test-entry')
      expect(content).toBe('Line 1\nLine 2')
    })

    it('should delete memory entry', async () => {
      await store.updateMemory('replace', 'test-entry', 'Test content', {
        entry_type: 'note',
      })

      await store.updateMemory('remove', 'test-entry', undefined)

      const content = await store.readMemory('test-entry')
      expect(content).toBeUndefined()
    })

    it('should return undefined for non-existent entry', async () => {
      const content = await store.readMemory('non-existent')
      expect(content).toBeUndefined()
    })

    it('should preserve metadata across updates', async () => {
      await store.updateMemory('replace', 'test-entry', 'Content', {
        entry_type: 'todo',
        status: 'open',
        priority: 'high',
        tags: 'bug,urgent',
      })

      await store.updateMemory('append', 'test-entry', ' - more info')

      const content = await store.readMemory('test-entry')
      expect(content).toBe('Content - more info')

      const entries = await store.queryMemory({ search: 'test-entry' }, { operation: 'select' })
      expect(Array.isArray(entries)).toBe(true)
      expect(entries).toHaveLength(1)
      const entryArray = entries as MemoryEntry[]
      expect(entryArray[0].entry_type).toBe('todo')
      expect(entryArray[0].status).toBe('open')
      expect(entryArray[0].priority).toBe('high')
      expect(entryArray[0].tags).toBe('bug,urgent')
    })
  })

  describe('Query Functionality', () => {
    beforeEach(async () => {
      // Setup test data
      await store.updateMemory('replace', 'todo-1', 'Fix login bug', {
        entry_type: 'todo',
        status: 'open',
        priority: 'high',
        tags: 'bug,auth',
      })
      await store.updateMemory('replace', 'todo-2', 'Add tests', {
        entry_type: 'todo',
        status: 'open',
        priority: 'medium',
        tags: 'testing',
      })
      await store.updateMemory('replace', 'todo-3', 'Refactor code', {
        entry_type: 'todo',
        status: 'done',
        priority: 'low',
        tags: 'cleanup',
      })
      await store.updateMemory('replace', 'bug-1', 'Security issue', {
        entry_type: 'bug',
        status: 'open',
        priority: 'critical',
        tags: 'security',
      })
      await store.updateMemory('replace', 'note-1', 'Meeting notes', {
        entry_type: 'note',
        status: undefined,
        priority: undefined,
        tags: 'documentation',
      })
    })

    it('should query all entries', async () => {
      const entries = await store.queryMemory({}, { operation: 'select' })
      expect(entries).toHaveLength(5)
    })

    it('should filter by type', async () => {
      const todos = await store.queryMemory({ type: 'todo' }, { operation: 'select' })
      expect(todos).toHaveLength(3)

      const bugs = await store.queryMemory({ type: 'bug' }, { operation: 'select' })
      expect(bugs).toHaveLength(1)
    })

    it('should filter by status', async () => {
      const open = await store.queryMemory({ status: 'open' }, { operation: 'select' })
      expect(open).toHaveLength(3)

      const done = await store.queryMemory({ status: 'done' }, { operation: 'select' })
      expect(done).toHaveLength(1)
    })

    it('should filter by priority', async () => {
      const high = await store.queryMemory({ priority: 'high' }, { operation: 'select' })
      expect(high).toHaveLength(1)

      const critical = await store.queryMemory({ priority: 'critical' }, { operation: 'select' })
      expect(critical).toHaveLength(1)
    })

    it('should filter by tags', async () => {
      const bugs = await store.queryMemory({ tags: 'bug' }, { operation: 'select' })
      expect(bugs).toHaveLength(1)
    })

    it('should search in content and name', async () => {
      const results = await store.queryMemory({ search: 'login' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(1)
      const resultArray = results as MemoryEntry[]
      expect(resultArray[0].name).toBe('todo-1')
    })

    it('should combine multiple filters', async () => {
      const results = await store.queryMemory({ type: 'todo', status: 'open' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(2)
    })

    it('should sort results', async () => {
      const results = await store.queryMemory({ sortBy: 'updated', sortOrder: 'desc' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(5)
      const resultArray = results as MemoryEntry[]
      // Last created should be first
      expect(resultArray[0].name).toBe('note-1')
    })

    it('should limit results', async () => {
      const results = await store.queryMemory({ limit: 2 }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(2)
    })

    it('should offset results', async () => {
      const page1 = await store.queryMemory({ limit: 2, offset: 0 }, { operation: 'select' })
      const page2 = await store.queryMemory({ limit: 2, offset: 2 }, { operation: 'select' })

      expect(Array.isArray(page1)).toBe(true)
      expect(Array.isArray(page2)).toBe(true)
      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)
      const page1Array = page1 as MemoryEntry[]
      const page2Array = page2 as MemoryEntry[]
      expect(page1Array[0].name).not.toBe(page2Array[0].name)
    })

    it('should count results', async () => {
      const count = await store.queryMemory({ type: 'todo' }, { operation: 'count' })
      expect(count).toBe(3)
    })
  })

  describe('Security and Validation', () => {
    it('should reject empty type', async () => {
      await expect(async () => {
        await store.queryMemory({ type: '  ' }, { operation: 'select' })
      }).toThrow('Type cannot be empty')
    })

    it('should reject invalid priority', async () => {
      await expect(async () => {
        await store.queryMemory({ priority: 'invalid' }, { operation: 'select' })
      }).toThrow('Invalid priority')
    })

    it('should reject invalid tags', async () => {
      await expect(async () => {
        await store.queryMemory({ tags: '   ' }, { operation: 'select' })
      }).toThrow('Tags cannot be empty')
    })

    it('should reject invalid limit', async () => {
      await expect(async () => {
        await store.queryMemory({ limit: -1 }, { operation: 'select' })
      }).toThrow('Limit must be between 1 and 10000')

      await expect(async () => {
        await store.queryMemory({ limit: 10001 }, { operation: 'select' })
      }).toThrow('Limit must be between 1 and 10000')
    })

    it('should reject invalid offset', async () => {
      await expect(async () => {
        await store.queryMemory({ offset: -1 }, { operation: 'select' })
      }).toThrow('Offset must be >= 0')
    })

    it('should reject invalid sortBy', async () => {
      await expect(async () => {
        await store.queryMemory({ sortBy: 'invalid' as any }, { operation: 'select' })
      }).toThrow('Invalid sortBy')
    })

    it('should reject invalid sortOrder', async () => {
      await expect(async () => {
        await store.queryMemory({ sortBy: 'created', sortOrder: 'invalid' as any }, { operation: 'select' })
      }).toThrow('Invalid sortOrder')
    })

    it('should sanitize search terms to prevent LIKE injection', async () => {
      await store.updateMemory('replace', 'test-1', 'Test content', {
        entry_type: 'note',
      })

      // This should not cause SQL errors
      const results = await store.queryMemory({ search: '%_' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
    })

    it('should validate path does not escape home directory', async () => {
      const configWithBadPath: MemoryConfig = {
        enabled: true,
        type: 'sqlite',
        path: '~/.config/polka-codes/../../../etc/passwd',
      }

      const badStore = new SQLiteMemoryStore(configWithBadPath, '/tmp/test')

      await expect(async () => {
        await badStore.updateMemory('replace', 'test', 'content', { entry_type: 'note' })
      }).toThrow()

      badStore.close()
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in content', async () => {
      const specialContent = `
        <script>alert("xss")</script>
        SQL: ' OR "1"="1
        Quotes: "double" and 'single'
        Newlines: \n\n
        Tabs: \t\t
      `

      await store.updateMemory('replace', 'special-chars', specialContent, {
        entry_type: 'note',
      })

      const content = await store.readMemory('special-chars')
      expect(content).toBe(specialContent)
    })

    it('should handle very long content', async () => {
      const longContent = 'x'.repeat(100000) // 100KB

      await store.updateMemory('replace', 'long-content', longContent, {
        entry_type: 'note',
      })

      const content = await store.readMemory('long-content')
      expect(content).toHaveLength(100000)
    })

    it('should handle unicode content', async () => {
      const unicodeContent = 'Hello 世界 🌍 🎉 emoji test'

      await store.updateMemory('replace', 'unicode', unicodeContent, {
        entry_type: 'note',
      })

      const content = await store.readMemory('unicode')
      expect(content).toBe(unicodeContent)
    })

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        store.updateMemory('replace', `concurrent-${i}`, `Content ${i}`, {
          entry_type: 'note',
        }),
      )

      await Promise.all(operations)

      const entries = await store.queryMemory({}, { operation: 'select' })
      expect(entries).toHaveLength(10)
    })

    it('should handle empty content error', async () => {
      await expect(async () => {
        await store.updateMemory('replace', 'test', '', { entry_type: 'note' })
      }).toThrow()
    })

    it('should handle default topic name', async () => {
      await store.updateMemory('replace', ':default:', 'Default content', {
        entry_type: 'note',
      })

      const content = await store.readMemory(':default:')
      expect(content).toBe('Default content')
    })
  })

  describe('Database Statistics', () => {
    it('should return correct statistics', async () => {
      await store.updateMemory('replace', 'todo-1', 'Content', { entry_type: 'todo' })
      await store.updateMemory('replace', 'todo-2', 'Content', { entry_type: 'todo' })
      await store.updateMemory('replace', 'bug-1', 'Content', { entry_type: 'bug' })

      const stats = await store.getStats()

      expect(stats.totalEntries).toBe(3)
      expect(stats.entriesByType.todo).toBe(2)
      expect(stats.entriesByType.bug).toBe(1)
      expect(stats.databaseSize).toBeGreaterThan(0)
    })

    it('should return zero statistics for empty database', async () => {
      const stats = await store.getStats()

      expect(stats.totalEntries).toBe(0)
      expect(stats.entriesByType).toEqual({})
    })
  })

  describe('Transaction Safety', () => {
    it('should rollback on error', async () => {
      await store.updateMemory('replace', 'test-1', 'Content 1', {
        entry_type: 'note',
      })

      // This should fail
      try {
        await store.transaction(async () => {
          await store.updateMemory('replace', 'test-2', 'Content 2', {
            entry_type: 'note',
          })
          throw new Error('Intentional error')
        })
      } catch {
        // Expected
      }

      // test-2 should not exist
      const content = await store.readMemory('test-2')
      expect(content).toBeUndefined()
    })

    it('should retry on lock', async () => {
      // Create a second store instance
      const store2 = new SQLiteMemoryStore(config, '/tmp/test-project')

      try {
        // Start transaction in first store
        const promise1 = store.transaction(async () => {
          await store.updateMemory('replace', 'test-1', 'Content 1', {
            entry_type: 'note',
          })
          // Hold the lock briefly
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'done'
        })

        // This should wait and retry
        const promise2 = store2.transaction(async () => {
          await store2.updateMemory('replace', 'test-2', 'Content 2', {
            entry_type: 'note',
          })
          return 'done'
        })

        await Promise.all([promise1, promise2])

        const content1 = await store.readMemory('test-1')
        const content2 = await store2.readMemory('test-2')

        expect(content1).toBe('Content 1')
        expect(content2).toBe('Content 2')
      } finally {
        store2.close()
      }
    })
  })

  describe('Scope Management', () => {
    it('should isolate entries by scope', async () => {
      const store1 = new SQLiteMemoryStore(config, '/tmp/project-1')
      const store2 = new SQLiteMemoryStore(config, '/tmp/project-2')

      try {
        await store1.updateMemory('replace', 'same-name', 'Project 1 content', {
          entry_type: 'note',
        })
        await store2.updateMemory('replace', 'same-name', 'Project 2 content', {
          entry_type: 'note',
        })

        const content1 = await store1.readMemory('same-name')
        const content2 = await store2.readMemory('same-name')

        expect(content1).toBe('Project 1 content')
        expect(content2).toBe('Project 2 content')
      } finally {
        store1.close()
        store2.close()
      }
    })

    it('should use the scope passed to constructor for queries', async () => {
      const testStore = new SQLiteMemoryStore(config, '/tmp/test-scope')

      await testStore.updateMemory('replace', 'test', 'content', { entry_type: 'note' })

      const entries = await testStore.queryMemory({ scope: 'project' as const }, { operation: 'select' })
      expect(Array.isArray(entries)).toBe(true)
      expect(entries).toHaveLength(1)
      const entryArray = entries as MemoryEntry[]
      expect(entryArray[0].scope).toBe('project:/tmp/test-scope')

      testStore.close()
    })
  })

  describe('Database Recovery', () => {
    it('should backup corrupted database', async () => {
      // Write initial data
      await store.updateMemory('replace', 'test-1', 'Content', { entry_type: 'note' })

      // Corrupt the database by writing garbage
      const { writeFileSync } = require('node:fs')
      writeFileSync(TEST_DB_PATH, 'corrupted data')

      // This should backup and recreate
      const newStore = new SQLiteMemoryStore(config, '/tmp/test-project')

      try {
        // Should work without error
        await newStore.updateMemory('replace', 'test-2', 'New content', {
          entry_type: 'note',
        })

        const content = await newStore.readMemory('test-2')
        expect(content).toBe('New content')

        // Old data should be gone
        const oldContent = await newStore.readMemory('test-1')
        expect(oldContent).toBeUndefined()
      } finally {
        newStore.close()
      }
    })
  })

  describe('Concurrency - Race Condition Fix', () => {
    it('should handle concurrent database initialization safely', async () => {
      // Create multiple stores with the same database path concurrently
      const stores = await Promise.all([
        new SQLiteMemoryStore(config, '/tmp/test-project'),
        new SQLiteMemoryStore(config, '/tmp/test-project'),
        new SQLiteMemoryStore(config, '/tmp/test-project'),
        new SQLiteMemoryStore(config, '/tmp/test-project'),
        new SQLiteMemoryStore(config, '/tmp/test-project'),
      ])

      try {
        // All stores should work correctly
        await Promise.all([
          stores[0].updateMemory('replace', 'test-0', 'Content 0', { entry_type: 'note' }),
          stores[1].updateMemory('replace', 'test-1', 'Content 1', { entry_type: 'note' }),
          stores[2].updateMemory('replace', 'test-2', 'Content 2', { entry_type: 'note' }),
          stores[3].updateMemory('replace', 'test-3', 'Content 3', { entry_type: 'note' }),
          stores[4].updateMemory('replace', 'test-4', 'Content 4', { entry_type: 'note' }),
        ])

        // Verify all data was written correctly
        const content0 = await stores[0].readMemory('test-0')
        const content1 = await stores[1].readMemory('test-1')
        const content2 = await stores[2].readMemory('test-2')
        const content3 = await stores[3].readMemory('test-3')
        const content4 = await stores[4].readMemory('test-4')

        expect(content0).toBe('Content 0')
        expect(content1).toBe('Content 1')
        expect(content2).toBe('Content 2')
        expect(content3).toBe('Content 3')
        expect(content4).toBe('Content 4')
      } finally {
        stores.forEach((s) => {
          s.close()
        })
      }
    })
  })

  describe('Tag Filtering Improvements', () => {
    beforeEach(async () => {
      // Create test entries with various tag formats
      await store.updateMemory('replace', 'entry1', 'Content 1', {
        entry_type: 'note',
        tags: 'fix-bug',
      })
      await store.updateMemory('replace', 'entry2', 'Content 2', {
        entry_type: 'note',
        tags: 'fix-bug,high-priority',
      })
      await store.updateMemory('replace', 'entry3', 'Content 3', {
        entry_type: 'note',
        tags: 'high-priority',
      })
      await store.updateMemory('replace', 'entry4', 'Content 4', {
        entry_type: 'note',
        tags: 'feature',
      })
    })

    it('should filter by exact tag match', async () => {
      const results = await store.queryMemory({ tags: 'fix-bug' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(2)
      const resultsArray = results as MemoryEntry[]
      expect(resultsArray.map((r) => r.name)).toContain('entry1')
      expect(resultsArray.map((r) => r.name)).toContain('entry2')
    })

    it('should filter by tag at beginning of comma list', async () => {
      const results = await store.queryMemory({ tags: 'high-priority' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(2)
      const resultsArray = results as MemoryEntry[]
      expect(resultsArray.map((r) => r.name)).toContain('entry2')
      expect(resultsArray.map((r) => r.name)).toContain('entry3')
    })

    it('should not match partial tags', async () => {
      // Should not match "fix-bug" when searching for "bug"
      const results = await store.queryMemory({ tags: 'bug' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(0)
    })

    it('should handle tags with spaces', async () => {
      await store.updateMemory('replace', 'entry5', 'Content 5', {
        entry_type: 'note',
        tags: 'fix bug',
      })

      const results = await store.queryMemory({ tags: 'fix bug' }, { operation: 'select' })
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(1)
      const resultArray = results as MemoryEntry[]
      expect(resultArray[0].name).toBe('entry5')
    })
  })

  describe('Batch Update Memory', () => {
    it('should perform multiple operations atomically in a single transaction', async () => {
      // Create initial entries
      await store.updateMemory('replace', 'entry1', 'Content 1', {
        entry_type: 'note',
        tags: 'tag1',
      })
      await store.updateMemory('replace', 'entry2', 'Content 2', {
        entry_type: 'note',
        tags: 'tag2',
      })

      // Perform batch update
      await store.batchUpdateMemory([
        {
          operation: 'replace',
          name: 'entry1',
          content: 'Updated Content 1',
          metadata: { entry_type: 'note', tags: 'updated-tag1' },
        },
        {
          operation: 'replace',
          name: 'entry2',
          content: 'Updated Content 2',
          metadata: { entry_type: 'note', tags: 'updated-tag2' },
        },
        {
          operation: 'replace',
          name: 'entry3',
          content: 'New Content 3',
          metadata: { entry_type: 'note', tags: 'tag3' },
        },
      ])

      // Verify all updates were applied
      const entry1 = await store.queryMemory({ search: 'entry1' }, { operation: 'select' })
      const entry2 = await store.queryMemory({ search: 'entry2' }, { operation: 'select' })
      const entry3 = await store.queryMemory({ search: 'entry3' }, { operation: 'select' })

      expect(Array.isArray(entry1)).toBe(true)
      expect(Array.isArray(entry2)).toBe(true)
      expect(Array.isArray(entry3)).toBe(true)

      expect(entry1).toHaveLength(1)
      const entry1Array = entry1 as MemoryEntry[]
      expect(entry1Array[0].content).toBe('Updated Content 1')
      expect(entry1Array[0].tags).toBe('updated-tag1')

      expect(entry2).toHaveLength(1)
      const entry2Array = entry2 as MemoryEntry[]
      expect(entry2Array[0].content).toBe('Updated Content 2')
      expect(entry2Array[0].tags).toBe('updated-tag2')

      expect(entry3).toHaveLength(1)
      const entry3Array = entry3 as MemoryEntry[]
      expect(entry3Array[0].content).toBe('New Content 3')
      expect(entry3Array[0].tags).toBe('tag3')
    })

    it('should support atomic rename using batch operations', async () => {
      // Create entry with metadata
      await store.updateMemory('replace', 'old-name', 'Content', {
        entry_type: 'note',
        status: 'active',
        priority: 'high',
        tags: 'important',
      })

      // Perform atomic rename using batch operations
      await store.batchUpdateMemory([
        {
          operation: 'replace',
          name: 'new-name',
          content: 'Content',
          metadata: { entry_type: 'note', status: 'active', priority: 'high', tags: 'important' },
        },
        { operation: 'remove', name: 'old-name' },
      ])

      // Verify rename worked and metadata was preserved
      const oldEntry = await store.queryMemory({ search: 'old-name' }, { operation: 'select' })
      const newEntry = await store.queryMemory({ search: 'new-name' }, { operation: 'select' })

      expect(Array.isArray(oldEntry)).toBe(true)
      expect(Array.isArray(newEntry)).toBe(true)

      expect(oldEntry).toHaveLength(0)
      expect(newEntry).toHaveLength(1)
      const newEntryArray = newEntry as MemoryEntry[]
      expect(newEntryArray[0].content).toBe('Content')
      expect(newEntryArray[0].entry_type).toBe('note')
      expect(newEntryArray[0].status).toBe('active')
      expect(newEntryArray[0].priority).toBe('high')
      expect(newEntryArray[0].tags).toBe('important')
    })
  })
})
