import type { ToolExample, ToolInfo } from '../tool'

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
