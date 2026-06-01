import { describe, expect, test } from 'bun:test'

describe('public CLI package entry', () => {
  test('does not install CLI process handlers when imported as a library', async () => {
    const beforeImport = process.listenerCount('uncaughtException')

    const api = await import('./index')

    expect(api.code).toBeFunction()
    expect('main' in api).toBe(false)
    expect(process.listenerCount('uncaughtException')).toBe(beforeImport)
  })
})
