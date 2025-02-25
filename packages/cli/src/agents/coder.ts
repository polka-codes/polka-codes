import { agentInfo } from '@polka-codes/core'
import { z } from 'zod'
import executeCommand, { type ExecuteCommandCallback } from '../tools/executeCommand'

export default (options: { executeCommand: ExecuteCommandCallback }) =>
  agentInfo({
    name: 'coder',
    description: 'Coder agent', // TODO
    systemPrompt: 'You must use one of the provided tools.', // TODO
    contextSchema: z
      .object({
        context: z.string().optional().describe('Additional context for the task'),
        relevantFiles: z.array(z.string()).optional().describe('Relevant files for the task'),
      })
      .optional(),
    tools: {
      executeCommand: executeCommand(options.executeCommand),
    },
  })
