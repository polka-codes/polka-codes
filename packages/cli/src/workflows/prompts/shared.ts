export function createJsonResponseInstruction(schema: Record<string, any>): string {
  return `Return one JSON object in a markdown \`json\` code block matching this shape:
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`
`
}

export const TOOL_USAGE_INSTRUCTION = `
## Action Line

Before each tool call, emit one short action line describing the immediate action.

Action line style:
- No filler or preambles.
- Do not use "ok", "okay", or "alright".
- Do not use first person.
- No apologies, hedging, or promises about later work.
`

export const MEMORY_USAGE_SECTION = `## Memory Usage

Use memory for durable project context that should survive this run: todos, bugs, decisions, and notes.

- Read memory when prior decisions or open tasks may affect the work.
- Update memory only with information that is useful later.
- Prefer descriptive topics such as "fix-login-bug" or "decision-auth-flow".
- Memory is project-scoped when a .polkacodes.yml file is present; otherwise it is global.
`

export function AGENTS_INSTRUCTION(loadRules?: Record<string, boolean>): string {
  // Merge with defaults to ensure consistent behavior
  const defaultLoadRules = {
    'AGENTS.md': true,
    'CLAUDE.md': true,
  }
  const mergedRules = { ...defaultLoadRules, ...loadRules }

  const enabledFiles = Object.entries(mergedRules)
    .filter(([, enabled]) => enabled)
    .map(([fileName]) => fileName)

  if (enabledFiles.length === 0) {
    return `## Project Instructions

Project-specific instruction files are currently disabled via configuration.`
  }

  const fileList = enabledFiles.join(', ')
  return `## Project Instructions (${fileList})

When working in a subdirectory, check the nearest ${enabledFiles.join(' or ')} file in that directory or its parents and follow it.
`
}
