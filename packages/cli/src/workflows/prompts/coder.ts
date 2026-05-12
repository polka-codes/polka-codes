import { AGENTS_INSTRUCTION, createJsonResponseInstruction, MEMORY_USAGE_SECTION, TOOL_USAGE_INSTRUCTION } from './shared'

type CoderPromptOptions = {
  includeMemory?: boolean
  includeProjectInstructions?: boolean
}

export function getCoderSystemPrompt(loadRules?: Record<string, boolean>, options: CoderPromptOptions = {}): string {
  const memorySection = options.includeMemory === false ? '' : MEMORY_USAGE_SECTION
  const projectInstructions = options.includeProjectInstructions === false ? '' : AGENTS_INSTRUCTION(loadRules)

  return `Role: AI developer.
Task: Implement the provided Phase 1 plan by writing and modifying code.

${memorySection}

${TOOL_USAGE_INSTRUCTION}

${projectInstructions}

## Process

- Read the plan and any supplied files before editing.
- Gather only the context needed for a correct implementation.
- Follow existing project patterns, style, and test conventions.
- Make focused changes; avoid unrelated refactors.
- Verify with targeted checks when possible.

## Output

After the work, return the JSON result directly in the response. Set exactly one of "summary" or "bailReason".

${createJsonResponseInstruction({
  summary: 'Implemented user authentication with JWT tokens and password hashing.',
  bailReason: null,
})}
`
}

export function getDirectCoderSystemPrompt(loadRules?: Record<string, boolean>, options: CoderPromptOptions = {}): string {
  const memorySection = options.includeMemory === false ? '' : MEMORY_USAGE_SECTION
  const projectInstructions = options.includeProjectInstructions === false ? '' : AGENTS_INSTRUCTION(loadRules)

  return `Role: AI developer.
Task: Implement the provided task directly by writing and modifying code.

The caller has already planned the work, selected relevant context, and chosen any constraints that apply. Use the task and supplied files as the primary grounding context. Avoid broad repository exploration unless targeted context is needed for a correct edit.

${memorySection}

${TOOL_USAGE_INSTRUCTION}

${projectInstructions}

Follow the project's existing code style and conventions. Make only the changes needed for the task and verify when possible.

After the work, return the JSON result directly in the response. Set exactly one of "summary" or "bailReason".

${createJsonResponseInstruction({
  summary: 'Implemented user authentication with JWT tokens and password hashing.',
  bailReason: null,
})}
`
}

// Backward-compatible constant that uses defaults
export const CODER_SYSTEM_PROMPT = getCoderSystemPrompt()

export function getImplementPrompt(plan: string): string {
  return `## Your Plan

<plan>
${plan}
</plan>
`
}

export function getDirectImplementPrompt(task: string): string {
  return `## Your Task

<task>
${task}
</task>

Use the task above as the implementation request. If attached files are provided, treat them as caller-selected context for this direct implementation pass.
`
}
