import { analyzerAgentInfo } from './AnalyzerAgent'
import { architectAgentInfo } from './ArchitectAgent'
import { codeFixerAgentInfo } from './CodeFixerAgent'
import { coderAgentInfo } from './CoderAgent'

export * from './AgentBase'
export * from './AgentPolicy'
export * from './CoderAgent'
export * from './ArchitectAgent'
export * from './AnalyzerAgent'
export * from './CodeFixerAgent'
export * from './MultiAgent'
export * from './prompts'
export * from './parseAssistantMessage'
export * from './policies'

export const allAgents = [architectAgentInfo, coderAgentInfo, analyzerAgentInfo, codeFixerAgentInfo] as const
export type AgentNameType = (typeof allAgents)[number]['name']
