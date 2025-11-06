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

You have access to a memory feature to store and retrieve information across tool calls.

### Topic Organization

Memory is organized using topics, which are like named containers for different types of information:
- **Default topic** (\`:default:\`): Used when no topic is specified. Good for general context.
- **Named topics**: Create meaningful topic names to organize different types of information

### Best Practices

- Store decisions and context that inform subsequent steps
- Use named topics to organize different types of information
- Use the default topic for simple, single-context scenarios
- Memory persists across all tool calls within the current workflow
`
