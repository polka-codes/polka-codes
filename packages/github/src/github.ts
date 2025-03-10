import type { Octokit } from '@octokit/core'
import { processBody } from './processBody'
import fetchIssueQuery from './queries/fetchIssue.gql' with { type: 'text' }
import fetchPRQuery from './queries/fetchPR.gql' with { type: 'text' }
import type { FetchIssueQuery, FetchPrQuery } from './types/github-types'

const query = (octokit: Octokit) => octokit.graphql

export async function fetchIssue(owner: string, repo: string, issueNumber: number, octokit: Octokit) {
  const resp = await query(octokit)<FetchIssueQuery>(fetchIssueQuery, { owner, repo, issueNumber })
  const issue = resp.repository?.issue
  if (!issue) {
    throw new Error('Issue not found')
  }
  const issueBody = await processBody(issue.body)
  let text = `#${issue.number}: ${issue.title}
${issueBody}
`
  const comments = issue.comments?.nodes

  if (comments) {
    const totalCount = issue.comments?.totalCount ?? 0
    const skipped = totalCount - (comments?.length ?? 0)

    text += '\n============ Comments ============\n'

    if (skipped > 0) {
      text += `${skipped} comment${skipped > 1 ? 's' : ''} skipped\n`
    }

    for (const comment of comments) {
      if (!comment) {
        continue
      }
      const commentBody = await processBody(comment.body)

      const author = comment.author?.login ?? 'unknown'

      text += `${comment.createdAt} @${author}:
${commentBody}
========================
`
    }
  }
  return text
}

export async function fetchPR(owner: string, repo: string, prNumber: number, octokit: Octokit) {
  const resp = await query(octokit)<FetchPrQuery>(fetchPRQuery, { owner, repo, prNumber })
  const pr = resp.repository?.pullRequest
  if (!pr) {
    throw new Error('PR not found')
  }

  const diff = await octokit.request({
    method: 'GET',
    url: `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    headers: {
      accept: 'application/vnd.github.v3.diff',
    },
  })

  const prBody = await processBody(pr.body)

  let text = `#${pr.number}: ${pr.title}
${prBody}
============ Diff ============
${diff.data}
`

  const comments = pr.comments?.nodes

  if (comments && comments.length > 0) {
    const totalCount = pr.comments?.totalCount ?? 0
    const skipped = totalCount - (comments?.length ?? 0)

    text += '\n============ Comments ============\n'

    if (skipped > 0) {
      text += `${skipped} comment${skipped > 1 ? 's' : ''} skipped\n`
    }

    for (const comment of comments) {
      if (!comment) {
        continue
      }
      if (comment.minimizedReason) {
        continue
      }
      const commentBody = await processBody(comment.body)

      const author = comment.author?.login ?? 'unknown'

      text += `${comment.createdAt} @${author}:
${commentBody}
========================
`
    }
  }

  const reviews = pr.reviews?.nodes

  if (reviews && reviews.length > 0) {
    const totalCount = pr.reviews?.totalCount ?? 0
    const skipped = totalCount - (reviews?.length ?? 0)

    if (skipped > 0) {
      text += `${skipped} review${skipped > 1 ? 's' : ''} skipped\n`
    }

    text += '\n============ Reviews ============\n'
    for (const review of reviews) {
      if (!review) {
        continue
      }

      const author = review.author?.login ?? 'unknown'
      const reviewBody = await processBody(review.body)

      text += `${review.createdAt} @${author}:
${reviewBody}
`
      const reviewComments = review.comments?.nodes
      if (reviewComments && reviewComments.length > 0) {
        text += '\n------------ Review Comments ------------\n'

        let lastDiff: string | undefined

        for (const comment of reviewComments) {
          if (!comment) {
            continue
          }
          if (comment.minimizedReason || comment.outdated) {
            continue
          }
          const commentBody = await processBody(comment.body)

          const author = comment.author?.login ?? 'unknown'

          if (comment.diffHunk === lastDiff) {
            text += `${comment.createdAt} @${author}:
${commentBody}
-----------------------
            `
          } else {
            text += `${comment.createdAt} @${author}:
Diff:
${comment.diffHunk}
Comment:
${commentBody}
-----------------------
`
          }
        }
      }
    }

    text += '========================\n'
  }

  return text
}
