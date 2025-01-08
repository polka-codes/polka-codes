import type { ToolInfo } from '../tool'

export interface TextContent {
  type: 'text'
  content: string
}

export interface ToolUse {
  type: 'tool_use'
  name: string
  params: Record<string, string>
}

export type AssistantMessageContent = TextContent | ToolUse

/**
 * Parse an assistant's message into an array of text content and tool use content.
 *
 * @example
 * const tools = [
 *   {
 *     name: "search",
 *     parameters: [
 *       {name: "query", type: "string"}
 *     ]
 *   }
 * ]
 *
 * // Text only
 * parseAssistantMessage("Hello world", tools, "tool_")
 * // Returns: [{type: "text", content: "Hello world"}]
 *
 * // Tool use with parameters
 * parseAssistantMessage(
 *   `Let me search that for you
 *   <tool_search>
 *     <tool_parameter_query>cats</tool_parameter_query>
 *   </tool_search>
 *   Here are the results`,
 *   tools,
 *   "tool_"
 * )
 * // Returns: [
 * //   {type: "text", content: "Let me search that for you"},
 * //   {type: "tool_use", name: "search", params: {query: "cats"}},
 * //   {type: "text", content: "Here are the results"}
 * // ]
 */
export function parseAssistantMessage(assistantMessage: string, tools: ToolInfo[], toolNamePrefix: string): AssistantMessageContent[] {
  const parameterPrefix = `${toolNamePrefix}parameter_`

  const results: AssistantMessageContent[] = []

  // Generate list of possible tool tags
  const toolTags = tools.map((tool) => `${toolNamePrefix}${tool.name}`)
  const toolPattern = toolTags.join('|')

  // Find the outermost tool tag by matching first opening and last closing tags
  const tagRegex = new RegExp(`<(${toolPattern})>(.*)<\\/\\1>`, 's')
  const match = assistantMessage.match(tagRegex)

  if (match) {
    // Split message into parts
    const beforeTag = assistantMessage.slice(0, match.index).trim()
    const fullTagContent = match[0]

    // Add text before tag if exists
    if (beforeTag) {
      results.push({
        type: 'text',
        content: beforeTag,
      })
    }

    // Find which tool was used
    const tagName = match[1]
    const toolName = tagName.replace(toolNamePrefix, '')
    const tool = tools.find((t) => t.name === toolName)

    if (tool) {
      // Parse parameters using new XML-like syntax
      const params: Record<string, string> = {}

      // Extract parameters while preserving nested content
      for (const param of tool.parameters) {
        const paramName = `${parameterPrefix}${param.name}`
        const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Match parameter content non-greedily while preserving nested content
        const paramPattern = `<${escapedParamName}>([\\s\\S]*?)<\\/${escapedParamName}>`
        const paramMatch = fullTagContent.match(new RegExp(paramPattern, 's'))
        if (paramMatch) {
          params[param.name] = paramMatch[1].trim()
        }
      }

      results.push({
        type: 'tool_use',
        name: toolName,
        params,
      })
    } else {
      // Unknown tool - treat as text
      results.push({
        type: 'text',
        content: fullTagContent,
      })
    }

    // Add text after the full tag if exists
    const afterTag = assistantMessage.slice((match.index ?? 0) + fullTagContent.length).trim()
    if (afterTag) {
      results.push({
        type: 'text',
        content: afterTag,
      })
    }
  } else {
    // No tool tags found, treat entire message as text
    results.push({
      type: 'text',
      content: assistantMessage,
    })
  }

  return results
}
