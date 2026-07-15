import { describe, expect, test } from 'bun:test'

describe('public runner package entry', () => {
  test('exports the runner API without executing the CLI', async () => {
    const api = await import('./index')

    expect(api.Runner).toBeFunction()
    expect(api.runRunner).toBeFunction()
  })
})
