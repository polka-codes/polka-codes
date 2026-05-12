import { createJsonResponseInstruction } from './shared'

export const META_SYSTEM_PROMPT = `Role: Meta-agent.
Task: Choose the workflow for the user's task.

- Use "code" for code changes, multi-file edits, bug fixes, tests, or implementation work.
- Use "task" for simple single-action requests such as answering a question or running a command.

The user's task is provided in the <task> tag.

${createJsonResponseInstruction({
  workflow: '<workflow_name>', // 'code' or 'task'
})}
`
