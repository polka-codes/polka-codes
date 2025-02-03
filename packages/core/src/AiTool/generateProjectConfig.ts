/**
 * AI tool for analyzing project files and generating polkacodes config sections.
 * Generated by polka.codes
 */

import type { AiToolDefinition } from './types'

const prompt = `
You are an advanced assistant specialized in analyzing project files and generating configuration for polka.codes. When you receive:
- A list of project files and their contents inside the <tool_input> tag.

You will produce a configuration object enclosed within <tool_output> tags containing:
1. scripts section based on package.json scripts and CI workflows
2. rules section based on project conventions, tools, and patterns

The configuration should accurately reflect the project's structure, tools, and conventions. Focus on:
- Package manager and dependency management
- Testing frameworks and patterns
- Code style and linting rules
- File organization and naming conventions
- Build and development workflows

Here's an example of the expected output format:

\`\`\`
<tool_output>
scripts:
  test:
    command: "bun test"
    description: "Run tests with bun:test"
  lint:
    command: "biome check ."
    description: "Check code style with Biome"

rules:
  - "Use \`bun\` as package manager"
  - "Write tests using bun:test with snapshots"
  - "Follow Biome code style"
</tool_output>
\`\`\`

Analyze the provided files to understand:
1. Build tools and package manager (e.g., bun, npm)
2. Testing framework and patterns
3. Code style tools and rules
4. Project structure and conventions
5. Common development workflows

Generate a configuration that captures these aspects in a clear and maintainable way.
`

export default {
  name: 'generateProjectConfig',
  description: 'Analyzes project files to generate polkacodes config sections',
  prompt,
  formatInput: (params: { files: Record<string, string> }) => {
    const fileContent = Object.entries(params.files)
      .map(([path, content]) => `=== ${path} ===\n${content}`)
      .join('\n\n')
    return `<tool_input>\n${fileContent}\n</tool_input>`
  },
  parseOutput: (output: string) => {
    const regex = /<tool_output>([\s\S]*)<\/tool_output>/gm
    const match = regex.exec(output)
    if (!match) {
      throw new Error(`Could not parse output:\n${output}`)
    }
    return match[1].trim()
  },
  agent: 'analyzer',
} as const satisfies AiToolDefinition<{ files: Record<string, string> }>
