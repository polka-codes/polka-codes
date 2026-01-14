import { beforeEach, describe, expect, test } from 'bun:test'
import { join } from '../path'
import type { ToolContext } from '../tool'
import { readFile, replaceInFile, writeToFile } from '.'
import type { FilesystemProvider } from './provider'
import { createFileReadTracker, markAsRead } from './utils/fileReadTracker'

describe('read-first enforcement', () => {
  const fileContents: Map<string, string> = new Map()

  // Helper to normalize path for consistency in mock
  const normalizeMockPath = (path: string) => join(path)

  const mockProvider: FilesystemProvider = {
    readFile: async (path, _includeIgnored) => {
      const normalizedPath = normalizeMockPath(path)
      if (normalizedPath === 'test.txt') return 'line1\nline2\nline3'
      if (normalizedPath === 'multi.txt') return 'content1'
      if (normalizedPath === 'test.ts') return 'old content\nline2'
      if (normalizedPath === 'config.js') return "const API_URL = 'https://api.example.com';"
      // Return from fileContents map (for existing.txt and dynamic files)
      return fileContents.get(normalizedPath) || undefined
    },
    writeFile: async (path, content) => {
      const normalizedPath = normalizeMockPath(path)
      fileContents.set(normalizedPath, content)
    },
    fileExists: async (path) => {
      const normalizedPath = normalizeMockPath(path)
      return fileContents.has(normalizedPath)
    },
  }

  function createToolContext(readSet?: Set<string>): ToolContext {
    return { readSet }
  }

  beforeEach(() => {
    fileContents.clear()
  })

  describe('readFile', () => {
    test('should mark files as read when context is provided', async () => {
      const readSet = createFileReadTracker()
      const context = createToolContext(readSet)

      await readFile.handler(mockProvider, { path: 'test.txt' }, context)

      expect(readSet.has('test.txt')).toBe(true)
    })

    test('should work without context (backward compatibility)', async () => {
      const result = await readFile.handler(mockProvider, { path: 'test.txt' })

      expect(result.success).toBe(true)
      expect(result.message.value).toContain('     1→line1')
      expect(result.message.value).toContain('     2→line2')
      expect(result.message.value).toContain('     3→line3')
    })

    test('should add line numbers to output', async () => {
      const result = await readFile.handler(mockProvider, { path: 'test.txt' })

      expect(result.success).toBe(true)
      expect(result.message.value).toContain('     1→line1')
      expect(result.message.value).toContain('     2→line2')
      expect(result.message.value).toContain('     3→line3')
    })

    test('should support offset parameter', async () => {
      const result = await readFile.handler(mockProvider, {
        path: 'test.txt',
        offset: 1 as any,
      })

      expect(result.success).toBe(true)
      expect(result.message.value).toContain('     2→line2')
      expect(result.message.value).toContain('     3→line3')
      expect(result.message.value).not.toContain('line1')
    })

    test('should support limit parameter', async () => {
      const result = await readFile.handler(mockProvider, {
        path: 'test.txt',
        limit: 2 as any,
      })

      expect(result.success).toBe(true)
      expect(result.message.value).toContain('     1→line1')
      expect(result.message.value).toContain('     2→line2')
      expect(result.message.value).not.toContain('line3')
    })

    test('should support offset and limit together', async () => {
      const result = await readFile.handler(mockProvider, {
        path: 'test.txt',
        offset: 1 as any,
        limit: 1 as any,
      })

      expect(result.success).toBe(true)
      expect(result.message.value).toContain('     2→line2')
      expect(result.message.value).not.toContain('line1')
      expect(result.message.value).not.toContain('line3')
    })
  })

  describe('writeToFile', () => {
    test('should write new file without reading when file does not exist', async () => {
      const readSet = createFileReadTracker()
      const context = createToolContext(readSet)

      const result = await writeToFile.handler(mockProvider, { path: 'new.txt', content: 'content' }, context)

      expect(result.success).toBe(true)
      expect(fileContents.get('new.txt')).toBe('content')
    })

    test('should fail when writing existing file without reading', async () => {
      // Pre-populate file
      fileContents.set('existing.txt', 'old content')
      const readSet = createFileReadTracker()
      const context = createToolContext(readSet)

      const result = await writeToFile.handler(mockProvider, { path: 'existing.txt', content: 'new content' }, context)

      expect(result.success).toBe(false)
      expect(result.message.value).toContain('Must read file before writing to existing file')
      expect(fileContents.get('existing.txt')).toBe('old content') // Unchanged
    })

    test('should succeed when writing existing file after reading', async () => {
      // Pre-populate and mark as read
      fileContents.set('existing.txt', 'old content')
      const readSet = createFileReadTracker()
      markAsRead(readSet, 'existing.txt')
      const context = createToolContext(readSet)

      const result = await writeToFile.handler(mockProvider, { path: 'existing.txt', content: 'new content' }, context)

      expect(result.success).toBe(true)
      expect(fileContents.get('existing.txt')).toBe('new content')
    })

    test('should work without context (backward compatibility)', async () => {
      const result = await writeToFile.handler(mockProvider, {
        path: 'test.txt',
        content: 'content',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('replaceInFile', () => {
    test('should fail when editing file without reading', async () => {
      const readSet = createFileReadTracker()
      const context = createToolContext(readSet)

      const result = await replaceInFile.handler(
        mockProvider,
        {
          path: 'test.ts',
          diff: `<<<<<<< SEARCH
old content
=======
new content
>>>>>>> REPLACE`,
        },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.message.value).toContain('Must read file before editing')
    })

    test('should succeed when editing file after reading', async () => {
      const readSet = createFileReadTracker()
      markAsRead(readSet, 'test.ts')
      const context = createToolContext(readSet)

      const result = await replaceInFile.handler(
        mockProvider,
        {
          path: 'test.ts',
          diff: `<<<<<<< SEARCH
old content
=======
new content
>>>>>>> REPLACE`,
        },
        context,
      )

      expect(result.success).toBe(true)
      expect(fileContents.get('test.ts')).toContain('new content')
    })

    test('should work without context (backward compatibility)', async () => {
      const result = await replaceInFile.handler(mockProvider, {
        path: 'config.js',
        diff: `<<<<<<< SEARCH
const API_URL = 'https://api.example.com';
=======
const API_URL = 'https://api.staging.example.com';
>>>>>>> REPLACE`,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('integration tests', () => {
    test('should enforce read-first across full workflow', async () => {
      const readSet = createFileReadTracker()
      const context = createToolContext(readSet)

      // 1. Try to write to non-existing file without reading - should succeed (new file)
      let result = await writeToFile.handler(mockProvider, { path: 'newfile.txt', content: 'new content' }, context)
      expect(result.success).toBe(true)

      // 2. Try to write to existing file without reading - should fail
      fileContents.set('existing.txt', 'old content')
      result = await writeToFile.handler(mockProvider, { path: 'existing.txt', content: 'new content' }, context)
      expect(result.success).toBe(false)
      expect(result.message.value).toContain('Must read file before writing')

      // 3. Read the file
      result = await readFile.handler(mockProvider, { path: 'existing.txt' }, context)
      expect(result.success).toBe(true)
      expect(readSet.has('existing.txt')).toBe(true)

      // 4. Now write should succeed
      result = await writeToFile.handler(mockProvider, { path: 'existing.txt', content: 'updated content' }, context)
      expect(result.success).toBe(true)
      expect(fileContents.get('existing.txt')).toBe('updated content')

      // 5. Can also edit
      result = await replaceInFile.handler(
        mockProvider,
        {
          path: 'existing.txt',
          diff: `<<<<<<< SEARCH
updated content
=======
modified content
>>>>>>> REPLACE`,
        },
        context,
      )
      if (!result.success) {
        console.log('Error:', result.message.value)
      }
      expect(result.success).toBe(true)
    })

    test('should handle path normalization correctly', async () => {
      const readSet = createFileReadTracker()
      const context = createToolContext(readSet)

      // Pre-populate a file (not one of the hardcoded ones)
      fileContents.set('normfile.txt', 'original content')

      // Read file with relative path
      let result = await readFile.handler(mockProvider, { path: 'normfile.txt' }, context)
      expect(result.success).toBe(true)
      expect(readSet.has('normfile.txt')).toBe(true)

      // Write to same file with different path format should succeed
      result = await writeToFile.handler(mockProvider, { path: './normfile.txt', content: 'new content' }, context)
      expect(result.success).toBe(true)

      // Edit with different path format should also succeed
      result = await replaceInFile.handler(
        mockProvider,
        {
          path: 'normfile.txt',
          diff: `<<<<<<< SEARCH
new content
=======
modified content
>>>>>>> REPLACE`,
        },
        context,
      )
      if (!result.success) {
        console.log('Error:', result.message.value)
      }
      expect(result.success).toBe(true)
    })
  })
})
