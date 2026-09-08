import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SQLiteMemoryStore } from './sqlite-memory-store'

async function withDatabase(run: (open: () => SQLiteMemoryStore, path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'memory-concurrency-'))
  const path = join(dir, 'memory.sqlite')
  const stores: SQLiteMemoryStore[] = []
  const open = () => {
    const store = new SQLiteMemoryStore({ enabled: true, type: 'sqlite', path }, 'global')
    stores.push(store)
    return store
  }
  try {
    await run(open, path)
  } finally {
    for (const store of stores) await store.close()
    await rm(dir, { recursive: true, force: true })
  }
}

test('interleaved writers and stale readers preserve committed updates and deletions', async () => {
  await withDatabase(async (open) => {
    const a = open()
    await a.updateMemory('replace', 'a', 'first')
    const b = open()
    const reader = open()
    await reader.readMemory('a')
    await b.updateMemory('replace', 'b', 'second')
    await a.updateMemory('append', 'a', 'updated')
    await b.updateMemory('remove', 'a', undefined)
    await a.updateMemory('replace', 'c', 'third')
    await Promise.all([a.updateMemory('append', 'b', 'A'), b.updateMemory('append', 'b', 'B')])
    await reader.close()
    await a.close()
    await b.close()
    const persisted = open()
    expect(await persisted.readMemory('a')).toBeUndefined()
    expect((await persisted.readMemory('b'))?.split('\n').sort()).toEqual(['A', 'B', 'second'])
    expect(await persisted.readMemory('c')).toBe('third')
  })
})

test('separate processes serialize nested transactions against the persisted database', async () => {
  await withDatabase(async (open, path) => {
    await open().updateMemory('replace', 'shared', 'seed')
    const fixture = fileURLToPath(new URL('./test-fixtures/write-memory.ts', import.meta.url))
    const children = ['a', 'b', 'c'].map((name) => Bun.spawn([process.execPath, fixture, path, name], { stdout: 'pipe', stderr: 'pipe' }))
    for (const child of children) {
      const stderr = await new Response(child.stderr).text()
      expect({ code: await child.exited, stderr }).toEqual({ code: 0, stderr: '' })
    }
    const persisted = open()
    expect((await persisted.readMemory('shared'))?.split('\n').sort()).toEqual(['a', 'b', 'c', 'seed'])
    for (const name of ['a', 'b', 'c']) expect(await persisted.readMemory(name)).toBe(name)
  })
})
