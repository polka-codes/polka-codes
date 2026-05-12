import { createJsonResponseInstruction, TOOL_USAGE_INSTRUCTION } from './shared'

export const GET_PR_DETAILS_SYSTEM_PROMPT = `Role: Expert developer.
Task: Generate a pull request title and description from the branch name, commit messages, and diff.

${TOOL_USAGE_INSTRUCTION}

Keep the title concise. In the description, summarize the user-visible or developer-visible changes and include verification only if it is present in the supplied context.

${createJsonResponseInstruction({
  title: 'feat: add new feature',
  description: 'This pull request adds a new feature that does...\\n\\n### Changes\\n- ...',
})}
`
