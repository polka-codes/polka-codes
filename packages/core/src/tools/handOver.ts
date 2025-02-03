/**
 * Tool for handing over a task to another agent.
 * Generated by polka.codes
 */

import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import { getString, getStringArray } from './utils'

export const toolInfo = {
  name: 'hand_over',
  description: 'Hand over the current task to another agent to complete',
  parameters: [
    {
      name: 'agent_name',
      description: 'The name of the agent to hand over the task to',
      required: true,
      usageValue: 'Name of the target agent',
    },
    {
      name: 'task',
      description: 'The task to be completed by the target agent',
      required: true,
      usageValue: 'Task description',
    },
    {
      name: 'context',
      description: 'The context information for the task',
      required: true,
      usageValue: 'Context information',
    },
    {
      name: 'files',
      description: 'The files relevant to the task',
      required: false,
      usageValue: 'Relevant files',
    },
  ],
  examples: [
    {
      description: 'Hand over a coding task to the coder agent',
      parameters: [
        {
          name: 'agent_name',
          value: 'coder',
        },
        {
          name: 'task',
          value: 'Implement the login feature',
        },
        {
          name: 'context',
          value: 'We need a secure login system with email and password',
        },
        {
          name: 'files',
          value: 'src/auth/login.ts,src/auth/types.ts',
        },
      ],
    },
  ],
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, any> = async (_provider, args) => {
  const agentName = getString(args, 'agent_name')
  const task = getString(args, 'task')
  const context = getString(args, 'context', undefined)
  const files = getStringArray(args, 'files', [])

  return {
    type: ToolResponseType.HandOver,
    agentName,
    task,
    context,
    files,
  }
}

export const isAvailable = (_provider: any): boolean => {
  return true
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
