import { SQLiteMemoryStore } from '../sqlite-memory-store'

const [path, name] = process.argv.slice(2)
const store = new SQLiteMemoryStore({ enabled: true, type: 'sqlite', path }, 'global')
await store.readMemory('shared')
await store.transaction(async () => {
  await store.updateMemory('replace', name, name)
  await Bun.sleep(20)
  await store.updateMemory('append', 'shared', name)
})
await store.close()
