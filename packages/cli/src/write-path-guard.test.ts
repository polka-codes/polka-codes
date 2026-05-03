import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { replaceInFile, type ToolProvider } from '@polka-codes/core'
import { createWritePathGuardedProvider } from './write-path-guard'

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'polka-write-guard-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function createFilesystemProvider(): ToolProvider {
  return {
    readFile: async (targetPath) => {
      try {
        return await readFile(targetPath, 'utf8')
      } catch {
        return undefined
      }
    },
    writeFile: async (targetPath, content) => {
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, content, 'utf8')
    },
    removeFile: async (targetPath) => {
      await unlink(targetPath)
    },
    renameFile: async (sourcePath, targetPath) => {
      await rename(sourcePath, targetPath)
    },
  }
}

describe('createWritePathGuardedProvider', () => {
  test('allows exact-file writes and rejects other files', async () => {
    await withTempDir(async (dir) => {
      const allowedFile = path.join(dir, 'allowed.txt')
      const outsideFile = path.join(dir, 'outside.txt')
      const provider = await createWritePathGuardedProvider(createFilesystemProvider(), [allowedFile])

      await provider.writeFile?.(allowedFile, 'allowed')
      await expect(provider.writeFile?.(outsideFile, 'outside')).rejects.toThrow('outside allowedWritePaths')

      expect(await readFile(allowedFile, 'utf8')).toBe('allowed')
    })
  })

  test('allows nested writes under an existing allowed directory and rejects siblings', async () => {
    await withTempDir(async (dir) => {
      const allowedDir = path.join(dir, 'src')
      const nestedFile = path.join(allowedDir, 'generated.ts')
      const siblingFile = path.join(dir, 'src-sibling', 'generated.ts')
      await mkdir(allowedDir, { recursive: true })

      const provider = await createWritePathGuardedProvider(createFilesystemProvider(), [allowedDir])

      await provider.writeFile?.(nestedFile, 'nested')
      await expect(provider.writeFile?.(siblingFile, 'sibling')).rejects.toThrow('outside allowedWritePaths')

      expect(await readFile(nestedFile, 'utf8')).toBe('nested')
    })
  })

  test('treats a trailing path separator as an allowed directory', async () => {
    await withTempDir(async (dir) => {
      const allowedDir = path.join(dir, 'generated')
      const nestedFile = path.join(allowedDir, 'test.ts')
      const provider = await createWritePathGuardedProvider(createFilesystemProvider(), [`${allowedDir}${path.sep}`])

      await provider.writeFile?.(nestedFile, 'generated')

      expect(await readFile(nestedFile, 'utf8')).toBe('generated')
    })
  })

  test('rejects removeFile outside allowed paths', async () => {
    await withTempDir(async (dir) => {
      const allowedFile = path.join(dir, 'allowed.txt')
      const outsideFile = path.join(dir, 'outside.txt')
      await writeFile(allowedFile, 'allowed')
      await writeFile(outsideFile, 'outside')

      const provider = await createWritePathGuardedProvider(createFilesystemProvider(), [allowedFile])

      await provider.removeFile?.(allowedFile)
      await expect(provider.removeFile?.(outsideFile)).rejects.toThrow('outside allowedWritePaths')

      expect(await readFile(outsideFile, 'utf8')).toBe('outside')
    })
  })

  test('requires rename source and target to both be allowed', async () => {
    await withTempDir(async (dir) => {
      const allowedDir = path.join(dir, 'allowed')
      const sourceFile = path.join(allowedDir, 'source.txt')
      const renamedFile = path.join(allowedDir, 'renamed.txt')
      const secondSourceFile = path.join(allowedDir, 'second-source.txt')
      const outsideFile = path.join(dir, 'outside.txt')
      await mkdir(allowedDir, { recursive: true })
      await writeFile(sourceFile, 'source')
      await writeFile(secondSourceFile, 'second')

      const provider = await createWritePathGuardedProvider(createFilesystemProvider(), [allowedDir])

      await provider.renameFile?.(sourceFile, renamedFile)
      await expect(provider.renameFile?.(secondSourceFile, outsideFile)).rejects.toThrow('outside allowedWritePaths')

      expect(await readFile(renamedFile, 'utf8')).toBe('source')
      expect(await readFile(secondSourceFile, 'utf8')).toBe('second')
    })
  })

  test('returns a replaceInFile error when the target write is outside allowed paths', async () => {
    await withTempDir(async (dir) => {
      const allowedFile = path.join(dir, 'allowed.rs')
      const outsideFile = path.join(dir, 'outside.rs')
      await writeFile(outsideFile, 'use super::*;\n\n')

      const provider = await createWritePathGuardedProvider(createFilesystemProvider(), [allowedFile])

      const result = await replaceInFile.handler(provider, {
        path: outsideFile,
        diff: `<<<<<<< SEARCH
use super::*;

=======
use super::*;

#[test]
fn generated_test() {}

>>>>>>> REPLACE`,
      })

      expect(result.success).toBe(false)
      expect(result.message.type).toBe('error-text')
      if (!('value' in result.message)) {
        throw new Error('Expected replaceInFile to return an error-text value')
      }
      expect(result.message.value).toContain('outside allowedWritePaths')
    })
  })
})
