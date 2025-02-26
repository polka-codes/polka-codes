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

1. **Thinking**: Use \`<thinking>\` XCM tag to clearly outline your thought process *before* using any tools. This includes:
  *  Assessing the current situation and available information.
  *  Defining specific goals and a plan to achieve them.
  *  Justifying the selection of a particular tool.
  *  Explaining how you intend to use the tool and what you expect to achieve.
2. **Tool Selection**: Choose one tool at a time per message based on the task and its description. Do not assume a tool’s outcome without explicit confirmation.
3. **Formatting**: Formulate tool use only in the specified XML format for each tool.
4. **User Response**: Wait for the user’s response after each tool use. Do not proceed until you have their confirmation. The user’s response may include:
  *  Tool success or failure details
  *  Linter errors
  *  Terminal output or other relevant feedback
5. **Conciseness**: Never repeat or quote the entire tool command in your final user-facing message. Summarize outcomes clearly and avoid echoing commands verbatim.
6. **Brevity**: Respond concisely and move the conversation forward. Do not re-issue the same command or re-trigger tool use without necessity.
7. **Iteration**: Follow these steps iteratively, confirming success and addressing issues as you go.
8. **Error Handling**: If a tool returns an error, analyze the error message and adjust your approach accordingly. Consider alternative tools or strategies to achieve the desired outcome.

By adhering to these guidelines:
- You maintain clarity without accidentally re-invoking tools.
- You confirm each step’s results before proceeding.
- You provide only the necessary information in user-facing replies to prevent re-interpretation as new commands.`
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
