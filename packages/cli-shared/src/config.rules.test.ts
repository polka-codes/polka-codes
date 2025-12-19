import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { resolveRules } from './config'

describe('resolveRules', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(global, 'fetch').mockImplementation((() => Promise.resolve(new Response('rule content'))) as any)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('resolves repo rule with default branch', async () => {
    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
      },
    ]

    await resolveRules(rules)

    expect(fetchSpy).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/main/rules/rule.md')
  })

  test('resolves repo rule with tag', async () => {
    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        tag: 'v1.0.0',
      },
    ]

    await resolveRules(rules)

    expect(fetchSpy).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/v1.0.0/rules/rule.md')
  })

  test('resolves repo rule with branch', async () => {
    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        branch: 'develop',
      },
    ]

    await resolveRules(rules)

    expect(fetchSpy).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/develop/rules/rule.md')
  })

  test('resolves repo rule with commit', async () => {
    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        commit: 'sha123',
      },
    ]

    await resolveRules(rules)

    expect(fetchSpy).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/sha123/rules/rule.md')
  })

  test('prioritizes commit over tag and branch', async () => {
    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        commit: 'sha123',
        tag: 'v1.0.0',
        branch: 'develop',
      },
    ]

    await resolveRules(rules)

    expect(fetchSpy).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/sha123/rules/rule.md')
  })

  test('prioritizes tag over branch', async () => {
    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        tag: 'v1.0.0',
        branch: 'develop',
      },
    ]

    await resolveRules(rules)

    expect(fetchSpy).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/v1.0.0/rules/rule.md')
  })
})
