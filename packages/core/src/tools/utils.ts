// Re-export from response-builders for backward compatibility
export { createProviderErrorResponse as createProviderError } from './response-builders'

/**
 * Simplify boolean string preprocessing
 * Converts 'true'/'false' strings to actual booleans
 */
export function preprocessBoolean(val: unknown): unknown {
  return typeof val === 'string' ? val.toLowerCase() === 'true' : val
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
