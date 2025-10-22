import { analyzerAgentInfo } from './AnalyzerAgent'
import { architectAgentInfo } from './ArchitectAgent'
import { codeFixerAgentInfo } from './CodeFixerAgent'
import { coderAgentInfo } from './CoderAgent'

export * from './AgentBase'
export * from './AgentPolicy'
export * from './AnalyzerAgent'
export * from './ArchitectAgent'
export * from './CodeFixerAgent'
export * from './CoderAgent'
export * from './MultiAgent'
export * from './parseAssistantMessage'
export * from './parseJsonFromMarkdown'
export * from './prompts'

export const allAgents = [architectAgentInfo, coderAgentInfo, analyzerAgentInfo, codeFixerAgentInfo] as const
export type AgentNameType = (typeof allAgents)[number]['name']
