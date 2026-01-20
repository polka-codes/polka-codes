type SimplifiedParams = Record<string, unknown>
type ParameterSimplifier = (params: Record<string, unknown>) => SimplifiedParams
type SimplifierMap = Record<string, ParameterSimplifier>

/**
 * Factory that creates a parameter simplifier which only keeps specified fields
 *
 * @param keepFields - Array of field names to preserve in the simplified params
 * @returns A simplifier function that filters to only the specified fields
 *
 * @example
 * ```typescript
 * const readFileSimplifier = createSimplifier(['path', 'includeIgnored'])
 * readFileSimplifier({ path: '/test', includeIgnored: true, extra: 'data' })
 * // Returns: { path: '/test', includeIgnored: true }
 * ```
 */
function createSimplifier(keepFields: string[]): ParameterSimplifier {
  return (params: Record<string, unknown>) => {
    const result: Record<string, unknown> = {}
    for (const field of keepFields) {
      if (params[field] !== undefined) {
        result[field] = params[field]
      }
    }
    return result
  }
}

/**
 * Factory that creates a simplifier with custom logic
 *
 * For cases where simple field filtering isn't enough, this allows
 * custom transformation logic while maintaining a consistent API.
 */
function createCustomSimplifier(transform: (params: Record<string, unknown>) => SimplifiedParams): ParameterSimplifier {
  return transform
}

// Simplifier registry using the factory pattern
const SIMPLIFIERS: SimplifierMap = {
  // Simple field-based simplifiers
  replaceInFile: createSimplifier(['path']),
  writeToFile: createSimplifier(['path']),
  readFile: createSimplifier(['path', 'includeIgnored']),
  executeCommand: createSimplifier(['command', 'requiresApproval']),
  updateMemory: createSimplifier(['operation', 'topic']),

  // searchFiles passes through all params
  searchFiles: createCustomSimplifier((params) => ({ ...params })),

  // listFiles has custom logic for maxCount default value
  listFiles: createCustomSimplifier((params) => {
    const DEFAULT_MAX_COUNT = 2000
    const maxCount = params.maxCount
    return {
      path: params.path,
      recursive: params.recursive,
      ...(maxCount !== DEFAULT_MAX_COUNT && { maxCount }),
    }
  }),
}

export function simplifyToolParameters(toolName: string, params: Record<string, unknown> | undefined): Record<string, unknown> {
  if (params === undefined || params === null) {
    return {}
  }

  const simplifier = SIMPLIFIERS[toolName]
  if (simplifier) {
    return simplifier(params)
  }

  return { ...params }
}
