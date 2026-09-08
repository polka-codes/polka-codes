import { expect, test } from 'bun:test'
import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQLiteMemoryStore } from './sqlite-memory-store'

async function withDatabase(run: (path: string, store: SQLiteMemoryStore) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'memory-recovery-'))
  const path = join(dir, 'memory.sqlite')
  const store = new SQLiteMemoryStore({ enabled: true, type: 'sqlite', path }, 'global')
  try {
    await store.updateMemory('replace', 'kept', 'original')
    await store.close()
    await run(path, store)
  } finally {
    await store.close()
    await rm(dir, { recursive: true, force: true })
  }
}

test('lock contention preserves committed database bytes and does not trigger recovery', async () => {
  await withDatabase(async (path, store) => {
    const before = await readFile(path)
    await writeFile(`${path}.lock`, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() - 60_000 }))
    try {
      await expect(store.updateMemory('replace', 'new', 'uncommitted')).rejects.toThrow('Cannot acquire lock')
      expect(await readFile(path)).toEqual(before)
      expect(await store.readMemory('kept')).toBe('original')
      expect((await readdir(join(path, '..'))).filter((name) => name.includes('.corrupted.'))).toEqual([])
    } finally {
      await rm(`${path}.lock`)
    }
  })
})

test('read permission errors retain their cause and leave valid data in place', async () => {
  await withDatabase(async (path, store) => {
    const before = await readFile(path)
    await chmod(path, 0)
    try {
      await expect(store.readMemory('kept')).rejects.toMatchObject({ code: 'EACCES' })
    } finally {
      await chmod(path, 0o600)
    }
    expect(await readFile(path)).toEqual(before)
    expect(await store.readMemory('kept')).toBe('original')
  })
})

test('confirmed corruption is backed up intact only by a writer holding the lock', async () => {
  await withDatabase(async (path, store) => {
    const damaged = 'this is not a database and must be retained in a backup'
    await writeFile(path, damaged)
    await expect(store.readMemory('kept')).rejects.toThrow('Invalid SQLite database header')
    expect(await readFile(path, 'utf8')).toBe(damaged)
    await store.updateMemory('replace', 'recovered', 'new')
    const dir = join(path, '..')
    const backups = (await readdir(dir)).filter((name) => name.includes('.corrupted.'))
    expect(backups).toHaveLength(1)
    expect(await readFile(join(dir, backups[0]), 'utf8')).toBe(damaged)
    await store.close()
    expect(await store.readMemory('recovered')).toBe('new')
  })
})
