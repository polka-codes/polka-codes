import { describe, expect, test } from 'bun:test'
import { createFileReadTracker, getReadCount, getReadFiles, hasBeenRead, markAsRead } from './fileReadTracker'

describe('file read tracking', () => {
  test('should mark files as read', () => {
    const readSet = createFileReadTracker()

    markAsRead(readSet, '/path/to/file.ts')

    expect(hasBeenRead(readSet, '/path/to/file.ts')).toBe(true)
    expect(hasBeenRead(readSet, '/other/path.ts')).toBe(false)
  })

  test('should track multiple files', () => {
    const readSet = createFileReadTracker()

    markAsRead(readSet, '/file1.ts')
    markAsRead(readSet, '/file2.ts')
    markAsRead(readSet, '/file3.ts')

    expect(getReadFiles(readSet)).toEqual(['/file1.ts', '/file2.ts', '/file3.ts'])
    expect(getReadCount(readSet)).toBe(3)
  })

  test('should create independent trackers', () => {
    const readSet1 = createFileReadTracker()
    const readSet2 = createFileReadTracker()

    markAsRead(readSet1, '/file1.ts')
    markAsRead(readSet2, '/file2.ts')

    expect(hasBeenRead(readSet1, '/file1.ts')).toBe(true)
    expect(hasBeenRead(readSet1, '/file2.ts')).toBe(false)
    expect(hasBeenRead(readSet2, '/file1.ts')).toBe(false)
    expect(hasBeenRead(readSet2, '/file2.ts')).toBe(true)
  })

  test('should handle duplicate marks gracefully', () => {
    const readSet = createFileReadTracker()

    markAsRead(readSet, '/file.ts')
    markAsRead(readSet, '/file.ts') // Mark same file again

    expect(getReadCount(readSet)).toBe(1)
    expect(getReadFiles(readSet)).toEqual(['/file.ts'])
  })

  test('should return empty array for new tracker', () => {
    const readSet = createFileReadTracker()

    expect(getReadFiles(readSet)).toEqual([])
    expect(getReadCount(readSet)).toBe(0)
  })

  test('should preserve insertion order', () => {
    const readSet = createFileReadTracker()

    markAsRead(readSet, '/zebra.ts')
    markAsRead(readSet, '/apple.ts')
    markAsRead(readSet, '/middle.ts')

    expect(getReadFiles(readSet)).toEqual(['/zebra.ts', '/apple.ts', '/middle.ts'])
  })
})
