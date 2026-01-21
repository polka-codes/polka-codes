import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// Import memory commands
import * as memory from './memory'

const TEST_DIR = '/tmp/polka-test-memory'
const TEST_DB = join(TEST_DIR, 'memory.sqlite')

// Mock the store
const createMockStore = () => ({
  queryMemory: mock(() => Promise.resolve([])),
  readMemory: mock(() => Promise.resolve(undefined)),
  updateMemory: mock(() => Promise.resolve(undefined)),
  batchUpdateMemory: mock(() => Promise.resolve(undefined)),
  getStats: mock(() => Promise.resolve({ totalEntries: 0, databaseSize: 0, entriesByType: {} })),
  close: mock(() => {}),
  transaction: mock(<T>(callback: () => Promise<T>) => callback()),
})

describe('Memory Commands - Real Behavior Tests', () => {
  let mockStore: ReturnType<typeof createMockStore>
  let getMemoryStoreSpy: any

  beforeEach(() => {
    // Create test directory
    mkdirSync(TEST_DIR, { recursive: true })

    // Create a test config
    const config = {
      memory: {
        enabled: true,
        type: 'sqlite' as const,
        path: TEST_DB,
      },
    }
    writeFileSync(join(TEST_DIR, '.polkacodes.yml'), JSON.stringify(config, null, 2))

    // Create mock store
    mockStore = createMockStore()

    // Mock getMemoryStore using spyOn
    getMemoryStoreSpy = spyOn(memory, 'getMemoryStore').mockResolvedValue(mockStore as any)
  })

  afterEach(() => {
    // Restore mock
    if (getMemoryStoreSpy) {
      getMemoryStoreSpy.mockRestore()
    }

    // Clean up test database
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB)
    }
  })

  describe('memoryList', () => {
    it('should split tags by comma', async () => {
      mockStore.queryMemory.mockResolvedValue([])

      await memory.memoryList({ tags: 'bug,urgent,high', format: 'table' })

      expect(mockStore.queryMemory).toHaveBeenCalledWith({ tags: ['bug', 'urgent', 'high'], scope: 'auto' }, { operation: 'select' })
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should output JSON format', async () => {
      const entries = [
        { name: 'test1', content: 'content1', entry_type: 'note' },
        { name: 'test2', content: 'content2', entry_type: 'todo' },
      ]
      mockStore.queryMemory.mockResolvedValue(entries as any)

      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryList({ format: 'json' })

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(entries, null, 2))
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should show "No entries found" when empty', async () => {
      mockStore.queryMemory.mockResolvedValue([])

      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryList({ format: 'table' })

      expect(consoleLogSpy).toHaveBeenCalledWith('No entries found.')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should close store even on error', async () => {
      mockStore.queryMemory.mockRejectedValue(new Error('DB error'))

      try {
        await memory.memoryList({ format: 'table' })
      } catch (_e) {
        // Expected error
      }

      expect(mockStore.close).toHaveBeenCalled()
    })
  })

  describe('memoryRead', () => {
    it('should exit when entry not found', async () => {
      mockStore.readMemory.mockResolvedValue(undefined)
      const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })

      try {
        await memory.memoryRead('nonexistent', {})
        expect(true).toBe(false) // Should not reach here
      } catch (e: any) {
        expect(e.message).toBe('process.exit called')
      }

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should output content in text format', async () => {
      mockStore.readMemory.mockResolvedValue('Test content here' as any)
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryRead('test-entry', {})

      expect(consoleLogSpy).toHaveBeenCalledWith('Test content here')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should output entry in JSON format', async () => {
      const entry = { name: 'test', content: 'content', entry_type: 'note', tags: 'important' }
      mockStore.readMemory.mockResolvedValue(entry.content as any)
      mockStore.queryMemory.mockResolvedValue([entry] as any)

      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryRead('test', { format: 'json' })

      const loggedArgs = consoleLogSpy.mock.calls.map((call) => call[0])
      const output = loggedArgs.join('\n')
      expect(output).toContain('content')
      expect(mockStore.close).toHaveBeenCalled()
    })
  })

  describe('memoryDelete', () => {
    it('should exit without force flag', async () => {
      const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })

      try {
        await memory.memoryDelete('test-entry', { force: false })
        expect(true).toBe(false)
      } catch (e: any) {
        expect(e.message).toBe('process.exit called')
      }

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(mockStore.updateMemory).not.toHaveBeenCalled()
    })

    it('should delete with force flag', async () => {
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryDelete('test-entry', { force: true })

      expect(mockStore.updateMemory).toHaveBeenCalledWith('remove', 'test-entry', undefined)
      expect(consoleLogSpy).toHaveBeenCalledWith('Memory entry "test-entry" deleted.')
      expect(mockStore.close).toHaveBeenCalled()
    })
  })

  describe('memoryRename - Metadata Preservation', () => {
    it('should preserve all metadata when renaming', async () => {
      const oldEntry = {
        name: 'old-name',
        content: 'Content',
        entry_type: 'note',
        status: 'active',
        priority: 'high',
        tags: 'important',
      }
      mockStore.queryMemory.mockResolvedValue([oldEntry] as any)
      mockStore.queryMemory.mockResolvedValueOnce([oldEntry] as any).mockResolvedValueOnce([])
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryRename('old-name', 'new-name')

      expect(mockStore.batchUpdateMemory).toHaveBeenCalledWith([
        {
          operation: 'replace',
          name: 'new-name',
          content: 'Content',
          metadata: {
            entry_type: 'note',
            status: 'active',
            priority: 'high',
            tags: 'important',
          },
        },
        { operation: 'remove', name: 'old-name' },
      ])
      expect(consoleLogSpy).toHaveBeenCalledWith('Memory entry renamed from "old-name" to "new-name".')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should exit when old entry not found', async () => {
      mockStore.queryMemory.mockResolvedValue([])
      const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      const consoleErrorSpy = spyOn(console, 'error')

      try {
        await memory.memoryRename('nonexistent', 'new-name')
        expect(true).toBe(false)
      } catch (e: any) {
        expect(e.message).toBe('process.exit called')
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('Memory entry "nonexistent" not found.')
      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should exit when new name already exists', async () => {
      const entry = { name: 'test', content: 'content' }
      mockStore.queryMemory.mockResolvedValue([entry] as any)
      const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      const consoleErrorSpy = spyOn(console, 'error')

      try {
        await memory.memoryRename('old-name', 'test')
        expect(true).toBe(false)
      } catch (e: any) {
        expect(e.message).toBe('process.exit called')
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('Memory entry "test" already exists.')
      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should preserve timestamps when renaming', async () => {
      const oldEntry = {
        name: 'old-name',
        content: 'Content',
        entry_type: 'note',
        status: 'active',
        priority: 'high',
        tags: 'important',
        created_at: 1234567890,
        updated_at: 1234567900,
        last_accessed: 1234568000,
      }
      mockStore.queryMemory.mockResolvedValue([oldEntry] as any)
      mockStore.queryMemory.mockResolvedValueOnce([oldEntry] as any).mockResolvedValueOnce([])
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryRename('old-name', 'new-name')

      expect(mockStore.batchUpdateMemory).toHaveBeenCalledWith([
        {
          operation: 'replace',
          name: 'new-name',
          content: 'Content',
          metadata: {
            entry_type: 'note',
            status: 'active',
            priority: 'high',
            tags: 'important',
            created_at: 1234567890,
            updated_at: 1234567900,
            last_accessed: 1234568000,
          },
        },
        { operation: 'remove', name: 'old-name' },
      ])
      expect(consoleLogSpy).toHaveBeenCalledWith('Memory entry renamed from "old-name" to "new-name".')
      expect(mockStore.close).toHaveBeenCalled()
    })
  })

  describe('memoryImport - Type Validation', () => {
    it('should skip non-object entries', async () => {
      const importFile = join(TEST_DIR, 'non-objects.json')
      writeFileSync(importFile, JSON.stringify(['string', 123, null]))
      mockStore.readMemory.mockResolvedValue(undefined)
      const consoleErrorSpy = spyOn(console, 'error')

      await memory.memoryImport(importFile, {})

      expect(consoleErrorSpy).toHaveBeenCalledWith('Skipping invalid entry: not an object')
      expect(mockStore.updateMemory).not.toHaveBeenCalled()
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should skip entries with null name', async () => {
      const importFile = join(TEST_DIR, 'null-name.json')
      writeFileSync(importFile, JSON.stringify([{ name: null, content: 'content' }]))
      mockStore.readMemory.mockResolvedValue(undefined)
      const consoleErrorSpy = spyOn(console, 'error')

      await memory.memoryImport(importFile, {})

      expect(consoleErrorSpy).toHaveBeenCalledWith('Skipping invalid entry: missing or invalid name')
      expect(mockStore.updateMemory).not.toHaveBeenCalled()
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should skip entries with non-string content', async () => {
      const importFile = join(TEST_DIR, 'non-string-content.json')
      writeFileSync(importFile, JSON.stringify([{ name: 'test', content: 12345 }]))
      mockStore.readMemory.mockResolvedValue(undefined)
      const consoleErrorSpy = spyOn(console, 'error')

      await memory.memoryImport(importFile, {})

      expect(consoleErrorSpy).toHaveBeenCalledWith('Skipping entry "test": missing or invalid content')
      expect(mockStore.updateMemory).not.toHaveBeenCalled()
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should validate and coerce non-string metadata types', async () => {
      const importFile = join(TEST_DIR, 'type-coercion.json')
      writeFileSync(
        importFile,
        JSON.stringify([
          { name: 'entry1', content: 'Content', entry_type: 123 }, // number -> defaults to 'note'
          { name: 'entry2', content: 'Content', status: null }, // null -> undefined
          { name: 'entry3', content: 'Content', tags: true }, // boolean -> undefined
        ]),
      )
      mockStore.readMemory.mockResolvedValue(undefined)
      mockStore.batchUpdateMemory.mockResolvedValue(undefined)
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryImport(importFile, {})

      // Verify batchUpdateMemory is called with the validated entries
      expect(mockStore.batchUpdateMemory).toHaveBeenCalledTimes(1)
      const batchCallArgs: any = mockStore.batchUpdateMemory.mock.calls[0]
      expect(batchCallArgs).toBeDefined()
      if (!batchCallArgs || batchCallArgs.length === 0) {
        throw new Error('batchUpdateMemory was not called with arguments')
      }
      const batchCallArg = batchCallArgs[0] as any[]
      expect(batchCallArg).toHaveLength(3)

      // Check entry1 (entry_type defaulted to 'note')
      expect(batchCallArg[0]).toEqual({
        operation: 'replace',
        name: 'entry1',
        content: 'Content',
        metadata: {
          entry_type: 'note',
          status: undefined,
          priority: undefined,
          tags: undefined,
        },
      })

      // Check entry2 (status null -> undefined)
      expect(batchCallArg[1]).toEqual({
        operation: 'replace',
        name: 'entry2',
        content: 'Content',
        metadata: {
          entry_type: 'note',
          status: undefined,
          priority: undefined,
          tags: undefined,
        },
      })

      // Check entry3 (tags boolean -> undefined)
      expect(batchCallArg[2]).toEqual({
        operation: 'replace',
        name: 'entry3',
        content: 'Content',
        metadata: {
          entry_type: 'note',
          status: undefined,
          priority: undefined,
          tags: undefined,
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Imported 3 entries, skipped 0 entries.')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should validate priority values and warn on invalid', async () => {
      const importFile = join(TEST_DIR, 'invalid-priority.json')
      writeFileSync(importFile, JSON.stringify([{ name: 'test', content: 'content', priority: 'invalid-priority' }]))
      mockStore.readMemory.mockResolvedValue(undefined)
      mockStore.batchUpdateMemory.mockResolvedValue(undefined)
      const consoleWarnSpy = spyOn(console, 'warn')
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryImport(importFile, {})

      expect(consoleWarnSpy).toHaveBeenCalledWith('Entry "test" has invalid priority "invalid-priority", defaulting to null')

      // Verify batchUpdateMemory is called with priority as undefined
      const batchCallArgs: any = mockStore.batchUpdateMemory.mock.calls[0]
      expect(batchCallArgs).toBeDefined()
      if (!batchCallArgs || batchCallArgs.length === 0) {
        throw new Error('batchUpdateMemory was not called with arguments')
      }
      const batchCallArg = batchCallArgs[0] as any[]
      expect(batchCallArg).toHaveLength(1)
      expect(batchCallArg[0]).toEqual({
        operation: 'replace',
        name: 'test',
        content: 'content',
        metadata: {
          entry_type: 'note',
          status: undefined,
          priority: undefined,
          tags: undefined,
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Imported 1 entries, skipped 0 entries.')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should skip existing entries without merge flag', async () => {
      const importFile = join(TEST_DIR, 'existing.json')
      writeFileSync(importFile, JSON.stringify([{ name: 'test', content: 'new content' }]))
      mockStore.readMemory.mockResolvedValue('old content' as any) // Entry exists
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryImport(importFile, { merge: false })

      expect(mockStore.updateMemory).not.toHaveBeenCalledWith('replace', 'test', 'new content')
      expect(consoleLogSpy).toHaveBeenCalledWith('Imported 0 entries, skipped 1 entries.')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should merge with existing entries when merge flag is set', async () => {
      const importFile = join(TEST_DIR, 'existing.json')
      writeFileSync(importFile, JSON.stringify([{ name: 'test', content: 'new content' }]))
      mockStore.readMemory.mockResolvedValue('old content' as any) // Entry exists
      mockStore.batchUpdateMemory.mockResolvedValue(undefined)
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryImport(importFile, { merge: true })

      expect(mockStore.batchUpdateMemory).toHaveBeenCalledWith([
        {
          operation: 'replace',
          name: 'test',
          content: 'new content',
          metadata: {
            entry_type: 'note',
            status: undefined,
            priority: undefined,
            tags: undefined,
          },
        },
      ])
      expect(consoleLogSpy).toHaveBeenCalledWith('Imported 1 entries, skipped 0 entries.')
      expect(mockStore.close).toHaveBeenCalled()
    })

    it('should exit on invalid JSON', async () => {
      const importFile = join(TEST_DIR, 'invalid.json')
      writeFileSync(importFile, '{ invalid json }')
      const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      const consoleErrorSpy = spyOn(console, 'error')

      try {
        await memory.memoryImport(importFile, {})
        expect(true).toBe(false)
      } catch (e: any) {
        expect(e.message).toBe('process.exit called')
      }

      // Check that console.error was called with the JSON parsing error
      const calls = consoleErrorSpy.mock.calls
      const errorCall = calls.find((call: any[]) => call[0]?.includes?.('Failed to parse JSON'))
      expect(errorCall).toBeDefined()
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should exit on non-array JSON', async () => {
      const importFile = join(TEST_DIR, 'not-array.json')
      writeFileSync(importFile, JSON.stringify({ key: 'value' }))
      const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      const consoleErrorSpy = spyOn(console, 'error')

      try {
        await memory.memoryImport(importFile, {})
        expect(true).toBe(false)
      } catch (e: any) {
        expect(e.message).toBe('process.exit called')
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid import file format. Expected an array of memory entries.')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('memoryStatus', () => {
    it('should display database statistics', async () => {
      mockStore.getStats.mockResolvedValue({
        totalEntries: 42,
        databaseSize: 12345,
        entriesByType: { note: 20, todo: 15, plan: 7 },
      })
      const consoleLogSpy = spyOn(console, 'log')

      await memory.memoryStatus()

      const loggedArgs = consoleLogSpy.mock.calls.map((call) => call[0])
      const output = loggedArgs.join('\n')

      expect(output).toContain('42')
      expect(mockStore.close).toHaveBeenCalled()
    })
  })
})
