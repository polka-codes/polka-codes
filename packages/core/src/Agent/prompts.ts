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

1. **In \`<thinking>\` tags**, assess what information you have and what you need to proceed.
2. **Choose one tool at a time per message** based on the task and its description. Do not assume a tool’s outcome without explicit confirmation.
3. **Formulate tool use only in the specified XML format** for each tool.
4. **Wait for the user’s response** after each tool use. Do not proceed until you have their confirmation.
5. The user’s response may include:
   - Tool success or failure details
   - Linter errors
   - Terminal output or other relevant feedback
6. **Never repeat or quote the entire tool command** in your final user-facing message. Summarize outcomes clearly and avoid echoing commands verbatim.
7. **Respond concisely** and move the conversation forward. Do not re-issue the same command or re-trigger tool use without necessity.
8. Follow these steps **iteratively**, confirming success and addressing issues as you go.

By adhering to these guidelines:
- You maintain clarity without accidentally re-invoking tools.
- You confirm each step’s results before proceeding.
- You provide only the necessary information in user-facing replies to prevent re-interpretation as new commands.`
}

export const agentsPrompt = (agents: AgentInfo[], name: string) => `
====

AVAILABLE AGENTS

The following agents are available for task handover:
${agents
  .map(
    (agent) => `
- **${agent.name}**
  - Responsibilities:
${agent.responsibilities.map((resp) => `    - ${resp}`).join('\n')}`,
  )
  .join('\n')}

- **Current Agent Role**
  You are currently acting as **${name}**. If you identify the task is beyond your current scope, use the handover tool to transition to the other agent. Include sufficient context so the new agent can seamlessly continue the work.
`

export const capabilities = (toolNamePrefix: string) => `
====

CAPABILITIES

- You have access to a range of tools to aid you in your work. These tools help you effectively accomplish a wide range of tasks, such as writing code, making edits or improvements to existing files, understanding the current state of a project, performing system operations, and much more.
- When the user initially gives you a task, a recursive list of all filepaths in the current working directory will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further.
- You can use ${toolNamePrefix}search_files to perform regex searches across files in a specified directory, outputting context-rich results that include surrounding lines. This is particularly useful for understanding code patterns, finding specific implementations, or identifying areas that need refactoring.
- You can use the ${toolNamePrefix}list_code_definition_names tool to get an overview of source code definitions for all files at the top level of a specified directory. This can be particularly useful when you need to understand the broader context and relationships between certain parts of the code. You may need to call this tool multiple times to understand various parts of the codebase related to the task.
	- For example, when asked to make edits or improvements you might analyze the file structure in the initial environment_details to get an overview of the project, then use ${toolNamePrefix}list_code_definition_names to get further insight using source code definitions for files located in relevant directories, then ${toolNamePrefix}read_file to examine the contents of relevant files, analyze the code and suggest improvements or make necessary edits, then use the ${toolNamePrefix}replace_in_file tool to implement changes. If you refactored code that could affect other parts of the codebase, you could use ${toolNamePrefix}search_files to ensure you update other files as needed.
- You can use the ${toolNamePrefix}execute_command tool to run commands on the user's computer whenever you feel it can help accomplish the user's task. When you need to execute a CLI command, you must provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, since they are more flexible and easier to run. Interactive and long-running commands are allowed, since the commands are run in the user's VSCode terminal. The user may keep commands running in the background and you will be kept updated on their status along the way. Each command you execute is run in a new terminal instance.`

export const systemInformation = (info: { os: string }) => `
====

SYSTEM INFORMATION

Operating System: ${info.os}`

export const interactiveMode = (interactive: boolean) => {
  if (interactive) {
    return `
====

INTERACTIVE MODE

You are in interactive mode. This means you may ask user questions to gather additional information to complete the task.
`
  }

  return `
====

NON-INTERACTIVE MODE

You are in non-interactive mode. This means you will not be able to ask user questions to gather additional information to complete the task. You should try to use available tools to accomplish the task. If unable to precede further, you may try to end the task and provide a reason.
`
}

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
  requireUseTool: 'Error: You must use a tool before proceeding',
  toolResults: (tool: string, result: string) => `<tool_response>
<tool_name>${tool}</tool_name>
<tool_result>
${result}
</tool_result>
</tool_response>`,
} as const
