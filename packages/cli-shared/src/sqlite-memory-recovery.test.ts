import { expect, test } from 'bun:test'
import { chmod, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

test.each(['', '{"pid":'])('recovers an abandoned malformed legacy lock: %j', async (content) => {
  await withDatabase(async (path, store) => {
    await writeFile(`${path}.lock`, content)
    const old = new Date(Date.now() - 60_000)
    await utimes(`${path}.lock`, old, old)
    await store.updateMemory('replace', 'new', 'committed')
    await store.close()
    expect(await store.readMemory('kept')).toBe('original')
    expect(await store.readMemory('new')).toBe('committed')
  })
})

test('does not reclaim a recent partial legacy lock', async () => {
  await withDatabase(async (path, store) => {
    const before = await readFile(path)
    await writeFile(`${path}.lock`, '{"pid":')
    await expect(store.updateMemory('replace', 'new', 'uncommitted')).rejects.toThrow('Cannot acquire lock')
    expect(await readFile(`${path}.lock`, 'utf8')).toBe('{"pid":')
    expect(await readFile(path)).toEqual(before)
  })
})

test('protects a live owner and serializes recovery after that process dies', async () => {
  await withDatabase(async (path, store) => {
    await store.updateMemory('replace', 'shared', 'seed')
    const holder = Bun.spawn([process.execPath, fileURLToPath(new URL('./test-fixtures/hold-memory.ts', import.meta.url)), path], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    try {
      const reader = holder.stdout.getReader()
      const ready = await reader.read()
      reader.releaseLock()
      expect(new TextDecoder().decode(ready.value)).toBe('locked\n')
      const ownerPath = join(`${path}.lock`, 'owner.json')
      await writeFile(ownerPath, JSON.stringify({ pid: holder.pid, acquiredAt: Date.now() - 60_000 }))
      const before = await readFile(path)
      await expect(store.updateMemory('replace', 'new', 'uncommitted')).rejects.toThrow('Cannot acquire lock')
      expect(await readFile(path)).toEqual(before)
      holder.kill('SIGKILL')
      await holder.exited

      const fixture = fileURLToPath(new URL('./test-fixtures/write-memory.ts', import.meta.url))
      const writers = ['a', 'b', 'c'].map((name) => Bun.spawn([process.execPath, fixture, path, name], { stdout: 'pipe', stderr: 'pipe' }))
      const results = await Promise.all(
        writers.map(async (writer) => ({ code: await writer.exited, stderr: await new Response(writer.stderr).text() })),
      )
      expect(results).toEqual(writers.map(() => ({ code: 0, stderr: '' })))
      await store.close()
      expect((await store.readMemory('shared'))?.split('\n').sort()).toEqual(['a', 'b', 'c', 'seed'])
      expect(await store.readMemory('not-committed')).toBeUndefined()
      expect(await store.readMemory('kept')).toBe('original')
      const retired = (await readdir(join(path, '..'))).filter((name) => name.startsWith('memory.sqlite.lock.retired-'))
      expect(retired).toHaveLength(1)
      expect(JSON.parse(await readFile(join(path, '..', retired[0], 'owner.json'), 'utf8')).pid).toBe(holder.pid)
    } finally {
      holder.kill('SIGKILL')
      await holder.exited
    }
  })
}, 10_000)
