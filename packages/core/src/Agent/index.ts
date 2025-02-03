import { analyzerAgentInfo } from './AnalyzerAgent'
import { architectAgentInfo } from './ArchitectAgent'
import { coderAgentInfo } from './CoderAgent'

export * from './AgentBase'
export * from './CoderAgent'
export * from './ArchitectAgent'
export * from './AnalyzerAgent'
export * from './MultiAgent'

export const allAgents = [architectAgentInfo, coderAgentInfo, analyzerAgentInfo] as const
export type AgentNameType = (typeof allAgents)[number]['name']
