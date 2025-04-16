import type { ToolExample, ToolInfo } from '../tool'
import type { AgentInfo } from './AgentBase'

const toolInfoPrompt = (tool: ToolInfo, toolNamePrefix: string, parameterPrefix: string) => `
## ${toolNamePrefix}${tool.name}

Description: ${tool.description}

Parameters:
${tool.parameters.map((param) => `- ${parameterPrefix}${param.name}: (${param.required ? 'required' : 'optional'}) ${param.description}`).join('\n')}

Usage:
<${toolNamePrefix}${tool.name}>
${tool.parameters.map((param) => `<${parameterPrefix}${param.name}>${param.usageValue}</${parameterPrefix}${param.name}>`).join('\n')}
</${toolNamePrefix}${tool.name}>`

const toolInfoExamplesPrompt = (idx: number, tool: ToolInfo, example: ToolExample, toolNamePrefix: string, parameterPrefix: string) => `
## Example ${idx + 1}: ${example.description}

<${toolNamePrefix}${tool.name}>
${example.parameters.map((param) => `<${parameterPrefix}${param.name}>${param.value}</${parameterPrefix}${param.name}>`).join('\n')}
</${toolNamePrefix}${tool.name}>
`

export const toolUsePrompt = (tools: ToolInfo[], toolNamePrefix: string) => {
  if (tools.length === 0) {
    return ''
  }

  const parameterPrefix = `${toolNamePrefix}parameter_`

  let exampleIndex = 0

  return `
====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<${toolNamePrefix}tool_name>
<${parameterPrefix}name1>value1</${parameterPrefix}name1>
<${parameterPrefix}name2>value2</${parameterPrefix}name2>
...
</${toolNamePrefix}tool_name>

For example:

<${toolNamePrefix}read_file>
<${parameterPrefix}path>src/main.js</${parameterPrefix}path>
</${toolNamePrefix}read_file>

Always adhere to this format for the tool use to ensure proper parsing and execution.

NEVER surround tool use with triple backticks (\`\`\`).

# Tools
${tools.map((tool) => toolInfoPrompt(tool, toolNamePrefix, parameterPrefix)).join('\n')}

# Tool Use Examples
${tools
  .map((tool) => {
    let promp = ''
    for (const example of tool.examples ?? []) {
      promp += toolInfoExamplesPrompt(exampleIndex++, tool, example, toolNamePrefix, parameterPrefix)
    }
    return promp
  })
  .join('')}
# Tool Use Guidelines

1. **Outline Your Thought Process**
  - Before using a tool, wrap your reasoning inside \`<thinking>\` tags. Be concise—just enough to clarify your plan and the rationale behind selecting a specific tool.

2. **Wait for Feedback**
  - After using a tool, wait for the user's response indicating success/failure or any output logs. Do not assume the result of a tool without explicit confirmation.

3. **Error Handling**
  - If a tool fails or produces an unexpected result, analyze the error, decide on an alternative approach or tool, and proceed carefully.

4. **Avoid Repetition**
  - Do not quote or repeat previous commands or prompts verbatim. Move the conversation forward by focusing on the latest required action.

5. **No Unnecessary Re-invocations**
  - Only invoke the same tool again if a genuine need arises (e.g., different parameters or updated context).`
}

export const agentsPrompt = (agents: Readonly<AgentInfo[]>, name: string) => `
====

AVAILABLE AGENTS

The following agents are available for task handover/delegate:
${agents
  .map(
    (agent) => `
- **${agent.name}**
  - Responsibilities:
${agent.responsibilities.map((resp) => `    - ${resp}`).join('\n')}`,
  )
  .join('\n')}

- **Current Agent Role**
  You are currently acting as **${name}**. If you identify the task is beyond your current scope, use the handover or delegate tool to transition to the other agent. Include sufficient context so the new agent can seamlessly continue the work.
`

export const capabilities = (toolNamePrefix: string) => `
====

CAPABILITIES

- You have access to a range of tools to aid you in your work. These tools help you effectively accomplish a wide range of tasks.
- When the user initially gives you a task, a recursive list of all filepaths in the current working directory will be included in context. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further.`

export const systemInformation = (info: { os: string }) => `
====

SYSTEM INFORMATION

Operating System: ${info.os}`

export const customInstructions = (customInstructions: string[]) => {
  const joined = customInstructions.join('\n')
  if (joined.trim() === '') {
    return ''
  }

  return `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${joined}`
}

export const customScripts = (commands: Record<string, string | { command: string; description: string }>) => {
  const joined = Object.entries(commands)
    .map(([name, command]) => {
      if (typeof command === 'string') {
        return `- ${name}\n  - Command: \`${command}\``
      }
      return `- ${name}\n  - Command: \`${command.command}\`\n  - Description: ${command.description}`
    })
    .join('\n')
  if (joined.trim() === '') {
    return ''
  }

  return `
====

USER'S CUSTOM COMMANDS

The following additional commands are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${joined}`
}

export const knowledgeManagementPrompt = `
====

# Knowledge Extraction & Maintenance

You are equipped with **Knowledge Management** capabilities:

1. **What to capture**
   • Public API of each file (public classes, functions, methods, parameters, return types).
   • High‑level description of each file’s purpose.
   • Invariants and assumptions that must always hold.
   • Project‑ or directory‑specific coding patterns, styles, and architectural conventions.
   • Rules (commenting, testing, documentation, security, etc.).
   • Any other insight that a future contributor would find crucial.

2. **Where to store it**
   • Save knowledge in a YAML file named \`knowledge.ai.yml\`.
   • One file per directory.
     – The repository root file records knowledge that applies project‑wide (e.g., service responsibilities, global patterns).
     – Each sub‑directory keeps only the knowledge relevant to that directory or package.
   • Use clear keys such as \`files\`, \`invariants\`, \`patterns\`, \`rules\`.

3. **When to update**
   • **While working**: after reading, analysing, creating, or modifying code, immediately record any new or changed knowledge.
   • **On refactor / deletion**: locate and delete or amend obsolete entries so that knowledge never drifts from the codebase.
   • **Granularity**: update only the affected directory’s \`knowledge.ai.yml\`, except when the change has global impact.

4. **How to format (illustrative)**
\`\`\`yaml
files:
  - path: "src/utils/math.ts"
    description: "Numeric helpers for currency calculations"
    api:
      functions:
        - name: "add"
          params: [{ name: "a", type: "number" }, { name: "b", type: "number" }]
          returns: "number"
invariants:
  - "All currency math uses BigInt to avoid floating‑point errors"
patterns:
  - "Prefer functional utilities over classes in utils/"
rules:
  - "Every exported function must have JSDoc"
\`\`\`

5. **Automatic context**
   When you are asked to read or modify a file, the orchestration layer will supply any existing knowledge for that path automatically. Use it, refine it, and keep it accurate.

Your workflow **must**:
   1. Detect knowledge deltas.
   2. Write edits to the correct \`knowledge.ai.yml\`.
   3. Remove stale facts.
   4. Use provided tools to update the knowledge files.

Adhere to these rules rigorously to ensure the codebase and its living documentation stay in sync.
`

export const responsePrompts = {
  errorInvokeTool: (tool: string, error: unknown) => `An error occurred while invoking the tool "${tool}": ${error}`,
  requireUseTool: 'Error: You MUST use a tool before proceeding using XCM tags. e.g. <tool_tool_name>tool_name</tool_tool_name>',
  toolResults: (tool: string, result: string) => `<tool_response>
<tool_name>${tool}</tool_name>
<tool_result>
${result}
</tool_result>
</tool_response>`,
  commandResult: (command: string, exitCode: number, stdout: string, stderr: string) => `<command>${command}</command>
<command_exit_code>${exitCode}</command_exit_code>
<command_stdout>
${stdout}
</command_stdout>
<command_stderr>
${stderr}
</command_stderr>`,
} as const
