// Custom Review-Fix-Commit Workflow
// This demonstrates how to create a custom workflow that combines
// review, fix, and commit operations in a single automated flow
//
// Usage:
//   bun run polka workflow -f examples/review-fix-commit.ts

import type { WorkflowFn } from '@polka-codes/core'
import type { BaseWorkflowInput } from '../packages/cli/src/workflows'
import { commit } from '../packages/cli/src/workflows/commit.workflow'
import { fix } from '../packages/cli/src/workflows/fix.workflow'
import { review } from '../packages/cli/src/workflows/review.workflow'

export interface ReviewFixCommitInput {
  maxIterations?: number
  autoFix?: boolean
  autoCommit?: boolean
  reviewContext?: string
}

export const reviewFixCommitWorkflow: WorkflowFn<
  ReviewFixCommitInput & BaseWorkflowInput,
  { iterations: number; commits: number; issuesFixed: number },
  any
> = async (input, context) => {
  const { maxIterations = 1, autoFix = true, autoCommit = true, reviewContext = '' } = input
  const { step, tools } = context

  let iterations = 0
  let commits = 0
  let issuesFixed = 0
  let hasChanges = true

  while (iterations < maxIterations && hasChanges) {
    iterations++

    // Check if there are changes to review
    const statusResult = await tools.executeCommand({
      command: 'git',
      args: ['status', '--porcelain=v1'],
    })

    hasChanges = statusResult.stdout.trim().length > 0

    if (!hasChanges) {
      context.logger.info('No more changes to review. Exiting.')
      break
    }

    context.logger.info(`\n${'='.repeat(60)}`)
    context.logger.info(`Review-Fix-Commit Cycle ${iterations}/${maxIterations}`)
    context.logger.info('='.repeat(60))

    // Step 1: Review changes
    const reviewResult = await step('Review changes', async () => {
      return await review(
        {
          context: reviewContext,
        },
        context,
      )
    })

    // Check if review found issues
    const hasIssues = reviewResult.specificReviews && reviewResult.specificReviews.length > 0

    const hasCriticalOrMajorIssues = reviewResult.specificReviews?.some((r) => r.severity === 'critical' || r.severity === 'major') ?? false

    if (!hasIssues) {
      context.logger.info('✅ No issues found in review!')

      // Commit if auto-commit is enabled
      if (autoCommit) {
        await step('Create commit', async () => {
          await commit({}, context)
          commits++
          context.logger.info('✅ Commit created successfully')
        })
      }

      continue
    }

    context.logger.info(`\n⚠️ Review found ${reviewResult.specificReviews.length} issues`)
    context.logger.info(
      `Critical/Major: ${reviewResult.specificReviews.filter((r) => r.severity === 'critical' || r.severity === 'major').length}`,
    )

    // Step 2: Fix issues if auto-fix is enabled
    if (autoFix && hasCriticalOrMajorIssues) {
      const fixDescription = `Fix the following issues from code review:\n\n${formatReviewForFix(reviewResult)}`

      await step('Fix issues', async () => {
        const fixResult = await fix({ task: fixDescription }, context)

        // Check if fix was successful
        if (fixResult.success === true) {
          issuesFixed++
          context.logger.info('✅ Issues fixed successfully')
        } else {
          context.logger.warn('⚠️ Some issues could not be auto-fixed')
        }
      })

      // Commit the fixes if auto-commit is enabled
      if (autoCommit) {
        await step('Commit fixes', async () => {
          await commit({}, context)
          commits++
          context.logger.info('✅ Fixes committed successfully')
        })
      }
    } else if (!autoFix) {
      context.logger.info('\nAuto-fix is disabled. Please fix issues manually.')
      context.logger.info('Review results:')
      context.logger.info(JSON.stringify(reviewResult, null, 2))
      break
    } else {
      context.logger.info('\nNo critical/major issues found. Skipping auto-fix.')
    }
  }

  return {
    iterations,
    commits,
    issuesFixed,
  }
}

function formatReviewForFix(reviewResult: { overview: string; specificReviews: any[] }): string {
  let output = `Overview: ${reviewResult.overview}\n\n`

  if (reviewResult.specificReviews && reviewResult.specificReviews.length > 0) {
    output += 'Issues to fix:\n'

    for (const review of reviewResult.specificReviews) {
      const severity = review.severity?.toUpperCase() || 'ISSUE'
      const file = review.file || 'Unknown file'
      const line = review.line || '?'
      output += `\n[${severity}] ${file}:${line}\n`
      output += `  ${review.description || 'No description'}\n`

      if (review.suggestion) {
        output += `  Suggestion: ${review.suggestion}\n`
      }
    }
  }

  return output
}
