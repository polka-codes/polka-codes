import { describe, expect, test } from 'bun:test'
import { Octokit } from '@octokit/core'
import { fetchIssue, fetchPR } from './github'

describe.skipIf(!process.env.GITHUB_TOKEN)('github', () => {
  test('fetchIssue', async () => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    const issue = await fetchIssue({ octokit, owner: 'polka-codes', repo: 'action', issueNumber: 1 })
    expect(issue).toMatchSnapshot()
  })

  test('fetchPR', async () => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    const pr = await fetchPR({ octokit, owner: 'polka-codes', repo: 'polka-codes', prNumber: 95 })
    expect(pr).toMatchSnapshot()
  })
})
