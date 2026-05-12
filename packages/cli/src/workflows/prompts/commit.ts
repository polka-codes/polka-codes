import { createJsonResponseInstruction, TOOL_USAGE_INSTRUCTION } from './shared'

export const COMMIT_MESSAGE_SYSTEM_PROMPT = `Role: Expert git user.
Task: Generate a concise conventional commit message for the staged changes.

${TOOL_USAGE_INSTRUCTION}

Use <file_status>, <diff>, and optional <tool_input_context>. Capture what changed and why without inventing issue references.

${createJsonResponseInstruction({
  commitMessage: 'feat: add new feature\\n\\ndescribe the new feature in more detail',
})}
`
