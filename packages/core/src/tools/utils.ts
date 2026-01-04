import type { FullToolInfo, ToolResponse } from '@polka-codes/core'

/**
 * Create a standardized error response for provider method not available
 */
export function createProviderError(action: string): ToolResponse {
  return {
    success: false,
    message: {
      type: 'error-text',
      value: `Not possible to ${action}.`,
    },
  }
}

/**
 * Create a tool export with default pattern
 */
export function createTool<T extends Record<string, unknown>>(
  toolInfo: T,
  handler: T extends { inputSchema: any } ? never : any,
): FullToolInfo {
  return {
    ...toolInfo,
    handler,
  } as unknown as FullToolInfo
}

/**
 * Simplify boolean string preprocessing
 * Converts 'true'/'false' strings to actual booleans
 */
export function preprocessBoolean(val: unknown): unknown {
  return typeof val === 'string' ? val.toLowerCase() === 'true' : val
}

/**
 * Format topic attribute for XML elements
 */
export function formatTopicAttribute(topic?: string): string {
  return topic ? ` topic="${topic}"` : ''
}

/**
 * Create a file content XML element
 */
export function createFileElement(tagName: string, path: string, content?: string, attrs?: Record<string, string>): string {
  const allAttrs = { path, ...attrs }
  const attrStr = Object.entries(allAttrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')

  if (content === undefined) {
    return `<${tagName}${attrStr} />`
  }

  const isEmpty = content.trim().length === 0
  if (isEmpty) {
    return `<${tagName}${attrStr} is_empty="true" />`
  }

  return `<${tagName}${attrStr}>${content}</${tagName}>`
}
