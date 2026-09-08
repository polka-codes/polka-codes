import { SQLiteMemoryStore } from '../sqlite-memory-store'

const store = new SQLiteMemoryStore({ enabled: true, type: 'sqlite', path: process.argv[2] }, 'global')
try {
  await store.updateMemory('replace', 'test', 'persisted')
  await store.close()
  if ((await store.readMemory('test')) !== 'persisted') throw new Error('Memory was not persisted')
} finally {
  await store.close()
}
