/**
 * Shared utilities for building tool response objects
 * Eliminates duplication across 20+ tool files
 */

import type { ToolResponse } from '../tool'

/**
 * Create a successful tool response
 *
 * @param value - The response value (string or JSON string)
 * @param type - Response type ('text' or 'json')
 * @returns A successful tool response object
 *
 * @example
 * ```ts
 * return createSuccessResponse('File content loaded')
 * return createSuccessResponse(JSON.stringify(data), 'json')
 * ```
 */
export function createSuccessResponse(value: string, type: 'text' | 'json' = 'text'): ToolResponse {
  return {
    success: true,
    message: { type, value },
  }
}

/**
 * Create an error tool response
 *
 * @param message - The error message
 * @returns An error tool response object
 *
 * @example
 * ```ts
 * return createErrorResponse('Failed to read file')
 * ```
 */
export function createErrorResponse(message: string): ToolResponse {
  return {
    success: false,
    message: { type: 'error-text', value: message },
  }
}

/**
 * Create a provider capability error response
 * Use this when a required provider capability is not available
 *
 * @param capability - The capability that's missing (e.g., "read file", "write file")
 * @returns An error response indicating the missing capability
 *
 * @example
 * ```ts
 * if (!provider.readFile) {
 *   return createProviderErrorResponse('read file')
 * }
 * ```
 */
export function createProviderErrorResponse(capability: string): ToolResponse {
  return {
    success: false,
    message: {
      type: 'error-text',
      value: `Not possible to ${capability}.`,
    },
  }
}

/**
 * Create a validation error response
 * Use this when input validation fails
 *
 * @param errors - The validation error details
 * @returns An error response with validation details
 *
 * @example
 * ```ts
 * const result = schema.safeParse(input)
 * if (!result.success) {
 *   return createValidationErrorResponse(result.error)
 * }
 * ```
 */
export function createValidationErrorResponse(errors: { message: string }): ToolResponse {
  return {
    success: false,
    message: {
      type: 'error-text',
      value: `Validation failed: ${errors.message}`,
    },
  }
}
