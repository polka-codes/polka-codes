import { createJsonResponseInstruction, TOOL_USAGE_INSTRUCTION } from './shared'

export const CODE_REVIEW_SYSTEM_PROMPT = `Role: Senior software engineer.
Task: Review code changes and report only actionable issues.

Available tools: git_diff, readFile, readBinaryFile, searchFiles, listFiles.
Do not use executeCommand or shell commands. Do not inspect node_modules, vendor, or other dependency directories.

${TOOL_USAGE_INSTRUCTION}

## Process

- Use \`<file_status>\` to choose reviewable source, config, and template files.
- Exclude lockfiles, generated artifacts, test snapshots, binary/media files, data fixtures, and dependency directories.
- Inspect each reviewable file with \`git_diff\` and the specific file path. Use staged: true for staged local changes when requested.
- Focus on modified lines and directly affected behavior. Do not review unchanged code or unrelated architecture.
- Use diff line annotations such as \`[Line N]\` or \`[Line N removed]\` for line references.
- Assume lint, type checking, and unit tests already passed; do not report compile errors.
- Do not praise, summarize positives, or request features outside the diff.
- For each issue, explain the concrete risk and a specific fix.

You may receive the following context:
-   \`<pr_title>\` and \`<pr_description>\`: PR context
-   \`<commit_messages>\`: Commits in the change
-   \`<user_context>\`: Specific review focus from the user
-   \`<file_status>\`: List of modified files with their status
-   \`<review_instructions>\`: Specific instructions for this review
-   \`<target_commit>\`: The specific commit being reviewed (when reviewing past commits)

## Output

${createJsonResponseInstruction({
  overview: "Summary of issues found, 'No issues found', or 'No reviewable changes' if all files were excluded.",
  specificReviews: [
    {
      file: 'path/to/file.ts',
      lines: '42 or 15-20',
      review: 'Specific issue description and actionable fix.',
    },
  ],
})}
`

export type ReviewToolInput = {
  pullRequestTitle?: string
  pullRequestDescription?: string
  commitMessages?: string
  commitRange?: string
  targetCommit?: string
  staged?: boolean
  changedFiles?: { path: string; status: string; insertions?: number; deletions?: number }[]
  context?: string
}

function formatContext(tag: string, value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  return `<${tag}>\n${value}\n</${tag}>`
}

function getReviewInstructions(params: ReviewToolInput): string {
  if (params.targetCommit) {
    return `Review the changes in commit '${params.targetCommit}'. Use git_diff with the file parameter to inspect what changed in each file. Focus on the actual diff.`
  }
  if (params.commitRange) {
    return `Review the pull request or commit range '${params.commitRange}'. Use git_diff with the file parameter to inspect the actual code changes.`
  }
  if (params.staged) {
    return 'Review the staged changes. Use git_diff with the file parameter and staged: true to inspect the actual code changes.'
  }
  return 'Review the unstaged changes. Use git_diff with the file parameter to inspect the actual code changes.'
}

export function formatReviewToolInput(params: ReviewToolInput): string {
  const fileList =
    params.changedFiles && params.changedFiles.length > 0
      ? params.changedFiles
          .map((file) => {
            let statString = ''
            if (file.insertions !== undefined || file.deletions !== undefined) {
              const ins = file.insertions ?? 0
              const del = file.deletions ?? 0
              statString = ` (+${ins}/-${del})`
            }
            return `${file.status}: ${file.path}${statString}`
          })
          .join('\n')
      : undefined

  const parts = [
    formatContext('pr_title', params.pullRequestTitle),
    formatContext('pr_description', params.pullRequestDescription),
    formatContext('commit_messages', params.commitMessages),
    formatContext('target_commit', params.targetCommit),
    formatContext('user_context', params.context),
    formatContext('file_status', fileList),
    formatContext('review_instructions', getReviewInstructions(params)),
  ]

  return parts.filter(Boolean).join('\n')
}
