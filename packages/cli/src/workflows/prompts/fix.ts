import { createJsonResponseInstruction, MEMORY_USAGE_SECTION, TOOL_USAGE_INSTRUCTION } from './shared'

export function getFixSystemPrompt(includeMemory = true): string {
  const memorySection = includeMemory ? MEMORY_USAGE_SECTION : ''

  return `Role: Expert software developer.
Task: Fix the failing command by finding the root cause and making targeted code changes.

${memorySection}

${TOOL_USAGE_INSTRUCTION}

## Process

- Use the command, exit code, stdout, stderr, task, and user prompt as context.
- Inspect relevant files before editing.
- Prefer the smallest fix that makes the command pass.
- Re-run the failing command or a narrower relevant check when possible.

## Output

Return the JSON result directly in the response. Set exactly one of "summary" or "bailReason".

${createJsonResponseInstruction({
  summary: "Fixed the 'add' function in 'math.ts' to correctly handle negative numbers.",
  bailReason: null,
})}
`
}

export function getFixUserPrompt(
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
  task?: string,
  prompt?: string,
): string {
  const taskSection = task ? `\n## Task\n\n${task}\n` : ''
  const promptSection = prompt ? `\n## User Prompt\n\n${prompt}\n` : ''

  return `## Context${taskSection}${promptSection}

The following command failed with exit code ${exitCode}:
\`${command}\`

<stdout>
${stdout || '(empty)'}
</stdout>

<stderr>
${stderr || '(empty)'}
</stderr>
`
}
