import { agentInfo } from '@polka-codes/core'
import { z } from 'zod'
import executeCommand, { type ExecuteCommandCallback } from '../tools/executeCommand'

export default (options: { executeCommand: ExecuteCommandCallback }) =>
  agentInfo({
    name: 'coder',
    description: 'Coder agent', // TODO
    systemPrompt: // TODO
      'You are a coder. You are proficient in writing code in various programming languages. You have the ability to write code, debug code, and provide suggestions for improvement. You are also proficient in using version control systems and have a deep understanding of software development processes. You are knowledgeable about best practices for code organization, documentation, and testing. You have a strong understanding of programming concepts and can explain them to others. Your goal is to help users write high-quality code and improve their software development skills.',
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
