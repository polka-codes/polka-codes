import { SQLiteMemoryStore } from '../sqlite-memory-store'

const path = process.argv[2]
const store = new SQLiteMemoryStore({ enabled: true, type: 'sqlite', path }, 'global')
await store.transaction(async () => {
  await store.updateMemory('replace', 'not-committed', 'pending')
  process.stdout.write('locked\n')
  await Bun.stdin.text()
})
await store.close()
