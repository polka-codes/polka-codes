import type { FilePart, ImagePart, TextPart, UserContent } from 'ai'
import type { FullToolInfoV2, ToolExample, ToolInfo, ToolParameterValue } from '../tool'
import { toToolInfoV1 } from '../tool-v1-compat'
import type { AgentInfo } from './AgentBase'

const renderParameterValue = (key: string, value: ToolParameterValue, parameterPrefix: string): string => {
  if (typeof value === 'string') {
    return `<${parameterPrefix}${key}>${value}</${parameterPrefix}${key}>`
  }
  if (Array.isArray(value)) {
    return value.map((v) => renderParameterValue(key, v, parameterPrefix)).join('\n')
  }

  const inner = Object.entries(value)
    .map(([key, v]) => renderParameterValue(key, v, parameterPrefix))
    .join('\n')
  return `<${parameterPrefix}${key}>\n${inner}\n</${parameterPrefix}${key}>`
}

const toolInfoPrompt = (tool: ToolInfo, toolNamePrefix: string, parameterPrefix: string) => `
## ${toolNamePrefix}${tool.name}

Description: ${tool.description}

Parameters:
${tool.parameters
  .map(
    (param) =>
      `- ${parameterPrefix}${param.name}: (${param.required ? 'required' : 'optional'})${param.allowMultiple ? ' (multiple allowed)' : ''} ${param.description}`,
  )
  .join('\n')}

Usage:
<${toolNamePrefix}${tool.name}>
${tool.parameters
  .map((param) =>
    param.allowMultiple
      ? `<${parameterPrefix}${param.name}>${param.usageValue}</${parameterPrefix}${param.name}>
<${parameterPrefix}${param.name}>${param.usageValue}</${parameterPrefix}${param.name}>`
      : `<${parameterPrefix}${param.name}>${param.usageValue}</${parameterPrefix}${param.name}>`,
  )
  .join('\n')}
</${toolNamePrefix}${tool.name}>`

const toolInfoExamplesPrompt = (tool: ToolInfo, example: ToolExample, toolNamePrefix: string, parameterPrefix: string) => `
## Example: ${example.description}

<${toolNamePrefix}${tool.name}>
${Object.entries(example.input)
  .map(([name, value]) => renderParameterValue(name, value, parameterPrefix))
  .join('\n')}
</${toolNamePrefix}${tool.name}>
`

export const toolUsePrompt = (tools: FullToolInfoV2[], toolNamePrefix: string) => {
  if (tools.length === 0) {
    return ''
  }

  const parameterPrefix = `${toolNamePrefix}parameter_`
  const v1Tools = tools.map(toToolInfoV1)

  return `
====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use up to 5 tool calls per message, and will receive the results of those tool uses in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<${toolNamePrefix}tool_name>
<${parameterPrefix}name1>value1</${parameterPrefix}name1>
<${parameterPrefix}name2>value2</${parameterPrefix}name2>
...
</${toolNamePrefix}tool_name>

**It is crucial that all tags are correctly nested and closed.**

## Array Parameters

To create an array of values for a parameter, repeat the parameter tag multiple times:

<${toolNamePrefix}process_file>
<${parameterPrefix}path>test.ts</${parameterPrefix}path>
<${parameterPrefix}path>main.ts</${parameterPrefix}path>
</${toolNamePrefix}process_file>

## Nested Object Parameters

To create nested objects, nest parameter tags within other parameter tags:

<${toolNamePrefix}example_tool>
<${parameterPrefix}key>
<${parameterPrefix}key2>value</${parameterPrefix}key2>
<${parameterPrefix}key3>value2</${parameterPrefix}key3>
</${parameterPrefix}key>
</${toolNamePrefix}example_tool>

You can also combine array parameters with nested objects:

<${toolNamePrefix}example_tool>
<${parameterPrefix}key>
<${parameterPrefix}key2>value</${parameterPrefix}key2>
<${parameterPrefix}key3>value2</${parameterPrefix}key3>
</${parameterPrefix}key>
<${parameterPrefix}key>
<${parameterPrefix}key2>value3</${parameterPrefix}key2>
<${parameterPrefix}key3>value4</${parameterPrefix}key3>
<${parameterPrefix}key3>value5</${parameterPrefix}key3>
</${parameterPrefix}key>
</${toolNamePrefix}example_tool>

Always adhere to this format, ensuring every opening tag has a matching closing tag, to ensure proper parsing and execution.

NEVER surround tool use with triple backticks (\`\`\`).

# Tools
${v1Tools.map((tool) => toolInfoPrompt(tool, toolNamePrefix, parameterPrefix)).join('\n')}

# Tool Use Examples
${v1Tools
  .map((tool) => {
    let promp = ''
    for (const example of tool.examples ?? []) {
      promp += toolInfoExamplesPrompt(tool, example, toolNamePrefix, parameterPrefix)
    }
    return promp
  })
  .join('')}
# Tool Use Guidelines

1. **Wait for Feedback**
  - After using a tool, wait for the user's response indicating success/failure or any output logs. Do not assume the result of a tool without explicit confirmation.
2. **Error Handling**
  - If a tool fails or produces an unexpected result, analyze the error, decide on an alternative approach or tool, and proceed carefully.
3. **Avoid Repetition**
  - Do not quote or repeat previous commands or prompts verbatim. Move the conversation forward by focusing on the latest required action.
4. **Tool Call Limit**
  - It is **STRIGHTLY FORBIDDEN** to make more than 5 tool calls in a single message.`
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

export const capabilities = (_toolNamePrefix: string) => `
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

export const responsePrompts = {
  errorInvokeTool: (tool: string, error: unknown) => `An error occurred while invoking the tool "${tool}": ${error}`,
  requireUseTool: `Error: No tool use detected. You MUST use a tool before proceeding.
e.g. <tool_tool_name>tool_name</tool_tool_name>

Ensure the opening and closing tags are correctly nested and closed, and that you are using the correct tool name.
Avoid unnecessary text or symbols before or after the tool use.
Avoid unnecessary escape characters or special characters.
`,
  toolResults: (tool: string, result: UserContent): Array<TextPart | ImagePart | FilePart> => {
    if (typeof result === 'string') {
      return [
        {
          type: 'text',
          text: `<tool_response name=${tool}>${result}</tool_response>`,
        },
      ]
    }
    return [
      {
        type: 'text',
        text: `<tool_response name=${tool}>`,
      },
      ...result,
      {
        type: 'text',
        text: '</tool_response>',
      },
    ]
  },
  commandResult: (command: string, exitCode: number, stdout: string, stderr: string) => `<command>${command}</command>
<command_exit_code>${exitCode}</command_exit_code>
<command_stdout>
${stdout}
</command_stdout>
<command_stderr>
${stderr}
</command_stderr>`,
} as const
