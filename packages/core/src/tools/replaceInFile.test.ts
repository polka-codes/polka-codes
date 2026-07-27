import { describe, expect, test } from 'bun:test'
import type { FilesystemProvider } from './provider'
import { handler } from './replaceInFile'

const replacement = (search: string, replace: string) => ['<<<<<<< SEARCH', search, '=======', replace, '>>>>>>> REPLACE'].join('\n')

describe('replaceInFile tool', () => {
  test('returns an error when the provider cannot read and write files', async () => {
    const result = await handler({}, {})

    expect(result).toEqual({
      success: false,
      message: { type: 'error-text', value: 'Not possible to replace in file.' },
    })
  })

  test('returns a file-not-found error', async () => {
    const provider: FilesystemProvider = {
      readFile: async () => undefined,
      writeFile: async () => {},
    }

    const result = await handler(provider, { path: 'missing.txt', diff: replacement('old', 'new') })

    expect(result).toMatchObject({ success: false, message: { type: 'error-text' } })
  })

  test('does not write when a SEARCH block is missing', async () => {
    let writeCount = 0
    const provider: FilesystemProvider = {
      readFile: async () => 'file content',
      writeFile: async () => {
        writeCount++
      },
    }

    const result = await handler(provider, { path: 'test.txt', diff: replacement('missing', 'new content') })

    expect(result).toMatchObject({ success: false, message: { type: 'error-text' } })
    expect(writeCount).toBe(0)
  })

  test('writes the fully replaced content', async () => {
    let write: { path: string; content: string } | undefined
    const provider: FilesystemProvider = {
      readFile: async () => 'old content',
      writeFile: async (path, content) => {
        write = { path, content }
      },
    }

    const result = await handler(provider, { path: 'test.txt', diff: replacement('old', 'new') })

    expect(result).toMatchObject({ success: true, message: { type: 'text' } })
    expect(write).toEqual({ path: 'test.txt', content: 'new content' })
  })
})
