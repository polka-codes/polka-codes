export function createJsonResponseInstruction(schema: Record<string, any>): string {
  return `Respond with a JSON object in a markdown code block matching this schema:
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`
`
}

export const TOOL_USAGE_INSTRUCTION = `
## Action Line

Before any tool call, emit a single high-level action line.

You MUST follow these style constraints for the action line:
- NO filler or preambles.
- DO NOT use "ok", "okay", "alright".
- DO NOT use first person ("I", "I'm", "I will", "I'll", etc.).
- NO apologies, hedging, or promises about later work.
`

export const MEMORY_USAGE_SECTION = `## Memory Usage

You have access to a persistent SQLite-based memory store to track information across sessions. This is particularly useful for managing todos, bugs, decisions, and notes.

### Memory Entry Types

Memory entries can be organized by type:
- **todo**: Task items with status (open/done), priority, and tags
- **bug**: Bug reports with priority and status
- **decision**: Architectural decisions and rationale
- **note**: General notes and documentation

### Todo List Workflow

When working on multi-step tasks, use the memory store to track progress:

**Creating a todo item:**
Use topic names that clearly describe the task. The content should include the full description.

**Updating todo status:**
- Mark todos as done when completed
- Update descriptions as requirements evolve
- Add tags for organization (e.g., "bug,urgent", "feature,auth")

**Querying todos:**
- Filter by type: "todo" to see all tasks
- Filter by status: "open" for pending work
- Filter by priority: "high" or "critical" for urgent items
- Search: Find specific todos by keyword

### Best Practices

- **Use descriptive topic names**: "fix-login-bug" is better than "bug-1"
- **Set appropriate priorities**: Use "critical", "high", "medium", or "low"
- **Add relevant tags**: Group related items with tags like "auth", "ui", "backend"
- **Update status regularly**: Mark items as done when completed
- **Store context**: Include important decisions in memory for future reference
- **Memory persists**: All stored information is available across sessions in the current project

### Memory Scopes

- **Project scope**: When working in a project directory (with .polkacodes.yml), memory is isolated to that project
- **Global scope**: When working outside a project, memory is shared globally
`

export const AGENTS_INSTRUCTION = `## AGENTS.md Instructions

If you are working in a subdirectory, check if there is an AGENTS.md file in that directory or parent directories for specific instructions. These files contain project-specific guidelines and conventions that you must follow.`
