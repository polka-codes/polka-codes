import { describe, expect, mock, test } from 'bun:test'
import { resolveRules } from './config'

describe('resolveRules', () => {
  test('resolves repo rule with default branch', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('rule content')))
    global.fetch = fetchMock as unknown as typeof fetch

    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
      },
    ]

    await resolveRules(rules)

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/main/rules/rule.md')
  })

  test('resolves repo rule with tag', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('rule content')))
    global.fetch = fetchMock as unknown as typeof fetch

    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        tag: 'v1.0.0',
      },
    ]

    await resolveRules(rules)

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/v1.0.0/rules/rule.md')
  })

  test('resolves repo rule with branch', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('rule content')))
    global.fetch = fetchMock as unknown as typeof fetch

    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        branch: 'develop',
      },
    ]

    await resolveRules(rules)

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/develop/rules/rule.md')
  })

  test('resolves repo rule with commit', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('rule content')))
    global.fetch = fetchMock as unknown as typeof fetch

    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        commit: 'sha123',
      },
    ]

    await resolveRules(rules)

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/sha123/rules/rule.md')
  })

  test('prioritizes commit over tag and branch', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('rule content')))
    global.fetch = fetchMock as unknown as typeof fetch

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

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/sha123/rules/rule.md')
  })

  test('prioritizes tag over branch', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('rule content')))
    global.fetch = fetchMock as unknown as typeof fetch

    const rules = [
      {
        repo: 'owner/repo',
        path: 'rules/rule.md',
        tag: 'v1.0.0',
        branch: 'develop',
      },
    ]

    await resolveRules(rules)

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/owner/repo/v1.0.0/rules/rule.md')
  })
})
