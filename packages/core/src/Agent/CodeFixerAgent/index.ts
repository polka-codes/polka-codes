/**
 * @file CodeFixerAgent implementation for fixing code issues like type errors and failing tests
 * Generated by polka.codes
 */

import { type ToolResponse, ToolResponseType, getAvailableTools } from '../../tool'
import { allTools, attemptCompletion } from '../../tools'
import { AgentBase } from '../AgentBase'
import type { AgentInfo, SharedAgentOptions } from '../AgentBase'
import { responsePrompts } from '../prompts'
import { fullSystemPrompt } from './prompts'

export type CodeFixerAgentOptions = SharedAgentOptions & {
  maxRetries?: number // Maximum retry attempts per issue
}

/**
 * CodeFixer agent for fixing code issues like type errors and failing tests.
 * Using Scripts: format, check, test
 */
export class CodeFixerAgent extends AgentBase {
  readonly #maxRetries: number
  #retryCount = 0

  constructor(options: CodeFixerAgentOptions) {
    const combinedTools = [...(options.additionalTools ?? []), ...Object.values(allTools)]
    const tools = getAvailableTools(options.provider, combinedTools, (options.agents?.length ?? 0) > 0)
    const toolNamePrefix = 'tool_'
    const systemPrompt = fullSystemPrompt(
      {
        os: options.os,
      },
      tools,
      toolNamePrefix,
      options.customInstructions ?? [],
      options.scripts ?? {},
      options.interactive,
    )

    super(codeFixerAgentInfo.name, options.ai, {
      systemPrompt,
      tools,
      toolNamePrefix,
      provider: options.provider,
      interactive: options.interactive,
      agents: options.agents,
      scripts: options.scripts,
      callback: options.callback,
    })

    this.#maxRetries = options.maxRetries ?? 5
  }

  protected async onBeforeInvokeTool(name: string, args: Record<string, string>): Promise<ToolResponse | undefined> {
    // If agent is about to attempt completion, check for any remaining issues
    if (name === attemptCompletion.name) {
      if (this.#retryCount > this.#maxRetries) {
        return
      }

      this.#retryCount++

      // Run final checks before completion
      const executeCommand = this.config.provider.executeCommand
      if (!executeCommand) {
        return
      }

      // Try to check the code one last time
      const check = this.config.scripts?.check
      const checkCommand = typeof check === 'string' ? check : check?.command
      if (checkCommand) {
        try {
          const { exitCode, stdout, stderr } = await executeCommand(checkCommand, false)
          if (exitCode !== 0) {
            return {
              type: ToolResponseType.Reply,
              message: responsePrompts.commandResult(checkCommand, exitCode, stdout, stderr),
            }
          }
        } catch (error) {
          console.warn(`Failed to check code using command: ${checkCommand}`, error)
        }
      }

      // Try to run tests one last time
      const test = this.config.scripts?.test
      const testCommand = typeof test === 'string' ? test : test?.command
      if (testCommand) {
        try {
          const { exitCode, stdout, stderr } = await executeCommand(testCommand, false)
          if (exitCode !== 0) {
            return {
              type: ToolResponseType.Reply,
              message: responsePrompts.commandResult(testCommand, exitCode, stdout, stderr),
            }
          }
        } catch (error) {
          console.warn(`Failed to test code using command: ${testCommand}`, error)
        }
      }
    }
  }
}

export const codeFixerAgentInfo = {
  name: 'codefixer',
  responsibilities: [
    'Fixing type errors and type-related issues',
    'Resolving failing tests',
    'Addressing code quality issues',
    'Tracking and reporting unfixed issues',
  ],
} as const satisfies AgentInfo
