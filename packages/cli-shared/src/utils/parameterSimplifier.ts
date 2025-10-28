type SimplifiedParams = Record<string, unknown>
type ParameterSimplifier = (params: Record<string, unknown>) => SimplifiedParams
type SimplifierMap = Record<string, ParameterSimplifier>

function replaceInFileSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { path: params.path }
}

function writeToFileSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { path: params.path }
}

function readFileSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { path: params.path, includeIgnored: params.includeIgnored }
}

function listFilesSimplifier(params: Record<string, unknown>): SimplifiedParams {
  const maxCount = params.maxCount
  return {
    path: params.path,
    recursive: params.recursive,
    ...(maxCount !== 2000 && { maxCount }),
  }
}

function searchFilesSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { ...params }
}

function executeCommandSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { command: params.command, requiresApproval: params.requiresApproval }
}

function updateMemorySimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { operation: params.operation, topic: params.topic }
}

const SIMPLIFIERS: SimplifierMap = {
  replaceInFile: replaceInFileSimplifier,
  writeToFile: writeToFileSimplifier,
  readFile: readFileSimplifier,
  listFiles: listFilesSimplifier,
  searchFiles: searchFilesSimplifier,
  executeCommand: executeCommandSimplifier,
  updateMemory: updateMemorySimplifier,
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
