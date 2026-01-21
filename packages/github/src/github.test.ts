import { describe, expect, test } from 'bun:test'
import { Octokit } from '@octokit/core'
import { fetchIssue, fetchPR } from './github'

describe.skipIf(!process.env.GITHUB_TOKEN)('github', () => {
  test('fetchIssue', async () => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    const issue = await fetchIssue({ octokit, owner: 'polka-codes', repo: 'action', issueNumber: 1 })

    // Verify the issue was fetched successfully
    expect(issue).toBeDefined()
    expect(typeof issue).toBe('string')
    expect(issue).toContain('#1:')
    expect(issue).toBeTruthy()
  })

  test('fetchPR', async () => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    const pr = await fetchPR({ octokit, owner: 'polka-codes', repo: 'polka-codes', prNumber: 95 })

    // Verify the PR was fetched successfully
    expect(pr).toBeDefined()
    expect(typeof pr).toBe('string')
    expect(pr).toContain('#95:')
    expect(pr).toContain('Diff')
    expect(pr).toBeTruthy()
  })
})
