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
    expect(issue?.number).toBe(1)
    expect(issue?.title).toBeTruthy()
    expect(issue?.body).toBeTruthy()
    expect(issue?.state).toBeTruthy()
    expect(issue?.user?.login).toBeTruthy()
  })

  test('fetchPR', async () => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    const pr = await fetchPR({ octokit, owner: 'polka-codes', repo: 'polka-codes', prNumber: 95 })

    // Verify the PR was fetched successfully
    expect(pr).toBeDefined()
    expect(pr?.number).toBe(95)
    expect(pr?.title).toBeTruthy()
    expect(pr?.body).toBeTruthy()
    expect(pr?.state).toBeTruthy()
    expect(pr?.user?.login).toBeTruthy()
    expect(pr?.head?.ref).toBeTruthy()
    expect(pr?.base?.ref).toBeTruthy()
  })
})
