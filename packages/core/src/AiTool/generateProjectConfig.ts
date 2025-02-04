/**
 * AI tool for analyzing project files and generating polkacodes config sections.
 * Generated by polka.codes
 */

import type { AiToolDefinition } from './types'

const prompt = `You are an analyzer agent responsible for examining project files and generating appropriate polkacodes configuration. Your task is to:

1. Read and analyze the provided files using tool_read_file to understand:
   - Build tools and package manager (e.g., bun, npm)
   - Testing frameworks and patterns
   - Code style tools and rules
   - Project structure and conventions
   - Common development workflows

2. Generate a YAML configuration that captures:
   - scripts section based on package.json scripts and CI workflows
   - rules section based on project conventions, tools, and patterns

3. Use tool_attempt_completion to return the final configuration in this format:

<tool_attempt_completion>
<tool_parameter_result>
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
</tool_parameter_result>
</tool_attempt_completion>

Focus on:
- Package manager and dependency management
- Testing frameworks and patterns
- Code style and linting rules
- File organization and naming conventions
- Build and development workflows

The configuration should accurately reflect the project's structure, tools, and conventions.
`

export default {
  name: 'generateProjectConfig',
  description: 'Analyzes project files to generate polkacodes config sections',
  prompt,
  formatInput: (params: string[]) => {
    return `<tool_input>\n${params.join('\n')}\n</tool_input>`
  },
  parseOutput: (output: string) => {
    return output.trim()
  },
  agent: 'analyzer',
} as const satisfies AiToolDefinition<string[]>
