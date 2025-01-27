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

// TODO: instead of just using regex, use a real parser
// Note that we can't use XML parser because the content is not real XML
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

  let remainingMessage = assistantMessage
  let match: RegExpExecArray | null

  // Create regex to find all tool tags
  const tagRegex = new RegExp(`<(${toolPattern})>([\\s\\S]*?)<\\/\\1>`, 's')

  while (true) {
    match = tagRegex.exec(remainingMessage)
    if (match === null) break

    // Add text before the tool tag if it exists
    const beforeTag = remainingMessage.slice(0, match.index).trim()
    if (beforeTag) {
      results.push({
        type: 'text',
        content: beforeTag,
      })
    }

    // Process the tool use
    const tagName = match[1]
    const toolName = tagName.replace(toolNamePrefix, '')
    const tool = tools.find((t) => t.name === toolName)
    const fullTagContent = match[0]

    if (tool) {
      // Parse parameters
      const params: Record<string, string> = {}
      for (const param of tool.parameters) {
        const paramName = `${parameterPrefix}${param.name}`
        const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

    // Update remaining message
    remainingMessage = remainingMessage.slice(match.index + fullTagContent.length)
  }

  // Add any remaining text after the last tool tag
  if (remainingMessage.trim()) {
    results.push({
      type: 'text',
      content: remainingMessage.trim(),
    })
  }

  // If no tool tags were found, treat entire message as text
  if (results.length === 0) {
    results.push({
      type: 'text',
      content: assistantMessage,
    })
  }

  return results
}
