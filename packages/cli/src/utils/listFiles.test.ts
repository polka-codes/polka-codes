import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import { listFiles } from './listFiles'

describe('listFiles', () => {
  const testDir = join(__dirname, 'test-fixtures')

  beforeAll(async () => {
    // Create test directory structure
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(join(testDir, '.gitignore'), 'ignored.txt\nsubdir/ignored-too.txt')
    await fs.writeFile(join(testDir, 'file1.txt'), '')
    await fs.writeFile(join(testDir, 'file2.txt'), '')
    await fs.writeFile(join(testDir, 'ignored.txt'), '')

    // Create subdirectory
    const subDir = join(testDir, 'subdir')
    await fs.mkdir(subDir)
    await fs.writeFile(join(subDir, 'file3.txt'), '')
    await fs.writeFile(join(subDir, 'ignored-too.txt'), '')
  })

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should list files in directory', async () => {
    const [files] = await listFiles(testDir, false, 10, testDir, [])
    expect(files).toEqual(['.gitignore', 'file1.txt', 'file2.txt'])
  })

  it('should list files recursively', async () => {
    const [files] = await listFiles(testDir, true, 10, testDir)
    expect(files).toEqual(['.gitignore', 'file1.txt', 'file2.txt', 'subdir/file3.txt'])
  })

  it('should respect maxCount and show truncation markers', async () => {
    const [files, limitReached] = await listFiles(testDir, true, 3, testDir)
    expect(limitReached).toBe(true)

    // Should include files up to the limit
    expect(files.includes('.gitignore')).toBe(true)
    expect(files.includes('file1.txt')).toBe(true)
    expect(files.includes('file2.txt')).toBe(true)

    // Should include the truncation marker for subdir
    expect(files.includes('subdir/(files omitted)')).toBe(true)

    // Total should be maxCount + truncation markers
    expect(files.length).toBe(4) // 3 files + 1 truncation marker
  })

  it('should show truncation markers for multiple directories', async () => {
    // Create additional nested directories
    const nestedDir1 = join(testDir, 'nested1')
    const nestedDir2 = join(testDir, 'nested2')
    await fs.mkdir(nestedDir1, { recursive: true })
    await fs.mkdir(nestedDir2, { recursive: true })
    await fs.writeFile(join(nestedDir1, 'nested-file1.txt'), '')
    await fs.writeFile(join(nestedDir2, 'nested-file2.txt'), '')

    // Set a low maxCount to force truncation
    const [files, limitReached] = await listFiles(testDir, true, 2, testDir)
    expect(limitReached).toBe(true)

    // Should include truncation markers
    const markers = files.filter((f) => f.includes('/(files omitted)'))
    expect(markers.length).toBeGreaterThan(0)

    // Clean up
    await fs.rm(nestedDir1, { recursive: true, force: true })
    await fs.rm(nestedDir2, { recursive: true, force: true })
  })

  it('should not show truncation markers when limit not reached', async () => {
    // Set a high maxCount to avoid truncation
    const [files, limitReached] = await listFiles(testDir, true, 100, testDir)
    expect(limitReached).toBe(false)

    // Should not include any truncation markers
    const markers = files.filter((f) => f.includes('/(files omitted)'))
    expect(markers.length).toBe(0)
  })

  it('should handle empty directory', async () => {
    const emptyDir = join(testDir, 'empty')
    await fs.mkdir(emptyDir)
    const [files] = await listFiles(emptyDir, true, 10, emptyDir)
    expect(files).toEqual([])
    await fs.rm(emptyDir, { recursive: true })
  })

  it('should handle non-existent directory', async () => {
    expect(listFiles(join(testDir, 'nonexistent'), false, 10, testDir)).rejects.toThrow()
  })
})
