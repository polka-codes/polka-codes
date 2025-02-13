// Generated by polka.codes
// Unit tests for tree-sitter parsing functionality

import { describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { parseSourceCodeForDefinitionsTopLevel, separateFiles } from './index'

describe('tree-sitter', () => {
  const testDir = join(__dirname, 'test-fixtures')

  describe('parseSourceCodeForDefinitionsTopLevel', () => {
    it('should successfully parse multiple files', async () => {
      const result = await parseSourceCodeForDefinitionsTopLevel(testDir, testDir)

      expect(result).toMatchSnapshot()
    })

    it('should handle empty directory', async () => {
      const emptyDir = join(testDir, 'empty')
      await fs.mkdir(emptyDir, { recursive: true })

      const result = await parseSourceCodeForDefinitionsTopLevel(emptyDir, emptyDir)
      expect(result).toBe('No source code definitions found.')

      await fs.rm(emptyDir, { recursive: true })
    })

    it('should respect file exclusions', async () => {
      const result = await parseSourceCodeForDefinitionsTopLevel(testDir, testDir, ['sample.ts'])

      // Should not contain TypeScript definitions
      expect(result).not.toContain('sample.ts')
      expect(result).not.toContain('class UserService')

      // Should still contain other definitions
      expect(result).toContain('sample.py')
      expect(result).toContain('class Calculator')
    })
  })

  describe('separateFiles', () => {
    it('should correctly filter supported file types', () => {
      const files = ['file.ts', 'file.js', 'file.py', 'file.txt', 'file.md', 'file.rs']

      const { filesToParse, remainingFiles } = separateFiles(files)

      expect(filesToParse).toContain('file.ts')
      expect(filesToParse).toContain('file.js')
      expect(filesToParse).toContain('file.py')
      expect(filesToParse).toContain('file.rs')
      expect(remainingFiles).toContain('file.txt')
      expect(remainingFiles).toContain('file.md')
    })

    it('should respect 50 file limit', () => {
      const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`)
      const { filesToParse } = separateFiles(files)

      expect(filesToParse.length).toBe(50)
    })

    it('should handle empty input', () => {
      const { filesToParse, remainingFiles } = separateFiles([])

      expect(filesToParse).toEqual([])
      expect(remainingFiles).toEqual([])
    })
  })
})
