export const TOOL_USAGE_INSTRUCTION =
  'Before each tool call, state the immediate action in one short line without filler, first person, apologies, hedging, or promises.'

export function AGENTS_INSTRUCTION(loadRules?: Record<string, boolean>): string {
  // Merge with defaults to ensure consistent behavior
  const defaultLoadRules = {
    'AGENTS.md': true,
    'CLAUDE.md': true,
  }
  const mergedRules = { ...defaultLoadRules, ...loadRules }

  const enabledFiles = Object.entries(mergedRules)
    .filter(([, enabled]) => enabled)
    .map(([fileName]) => fileName)

  if (enabledFiles.length === 0) {
    return ''
  }

  return `## Project Instructions

When working in a subdirectory, check the nearest ${enabledFiles.join(' or ')} file in that directory or its parents and follow it.
`
}
