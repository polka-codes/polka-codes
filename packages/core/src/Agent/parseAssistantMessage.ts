import type { ToolInfo } from '../tool'

export interface TextContent {
  type: 'text'
  content: string
}

export interface ToolUse {
  type: 'tool_use'
  name: string
  params: Record<string, any> // Changed from Record<string, string> to support arrays and nested objects
}

export type AssistantMessageContent = TextContent | ToolUse

// Helper function to parse nested parameters
function parseNestedParameters(content: string, parameterPrefix: string): Record<string, any> {
  const result: Record<string, any> = {}
  const nestedParamRegex = new RegExp(`<${parameterPrefix}([^>]+)>([\\s\\S]*?)<\\/${parameterPrefix}\\1>`, 'gs')

  while (true) {
    const match = nestedParamRegex.exec(content)
    if (match === null) break

    const paramName = match[1]
    const paramContent = match[2].trim()

    // Check if the content has nested parameters
    if (paramContent.includes(`<${parameterPrefix}`)) {
      // Recursively parse nested parameters
      result[paramName] = parseNestedParameters(paramContent, parameterPrefix)
    } else {
      result[paramName] = paramContent
    }
  }

  return result
}

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
 *
 * // Array mode (multiple occurrences of the same parameter)
 * parseAssistantMessage(
 *   `<tool_read_file>
 *     <tool_parameter_path>test.ts</tool_parameter_path>
 *     <tool_parameter_path>main.ts</tool_parameter_path>
 *   </tool_read_file>`,
 *   tools,
 *   "tool_"
 * )
 * // Returns: [
 * //   {type: "tool_use", name: "read_file", params: {path: ["test.ts", "main.ts"]}}
 * // ]
 *
 * // Nested objects
 * parseAssistantMessage(
 *   `<tool_example>
 *     <tool_parameter_key>
 *       <tool_parameter_key2>value</tool_parameter_key2>
 *       <tool_parameter_key3>value2</tool_parameter_key3>
 *     </tool_parameter_key>
 *   </tool_example>`,
 *   tools,
 *   "tool_"
 * )
 * // Returns: [
 * //   {type: "tool_use", name: "example", params: {key: {key2: "value", key3: "value2"}}}
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
      const params: Record<string, any> = {}
      for (const param of tool.parameters) {
        const paramName = `${parameterPrefix}${param.name}`
        const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Find all occurrences of this parameter
        const paramRegex = new RegExp(`<${escapedParamName}>([\\s\\S]*?)<\\/${escapedParamName}>`, 'gs')
        const paramMatches: string[] = []

        while (true) {
          const paramMatch = paramRegex.exec(fullTagContent)
          if (paramMatch === null) break
          paramMatches.push(paramMatch[1].trim())
        }

        if (paramMatches.length > 0) {
          if (paramMatches.length === 1) {
            const paramContent = paramMatches[0]

            // Check if the parameter has nested content
            if (paramContent.includes(`<${parameterPrefix}`)) {
              // Parse nested parameters
              params[param.name] = parseNestedParameters(paramContent, parameterPrefix)
            } else {
              // Regular parameter
              params[param.name] = paramContent
            }
          } else {
            // Array mode - multiple occurrences of the same parameter
            params[param.name] = paramMatches
          }
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
