import { getAvailableTools } from '../../getAvailableTools'
import { PermissionLevel, type ToolResponse, ToolResponseType } from '../../tool'
import { allTools, attemptCompletion } from '../../tools'
import { UsageMeter } from '../../UsageMeter'
import type { AgentInfo, SharedAgentOptions } from './../AgentBase'
import { AgentBase } from '../AgentBase'
import { responsePrompts } from '../prompts'
import { fullSystemPrompt } from './prompts'

export type CoderAgentOptions = SharedAgentOptions

/**
 * Coder agent for writing code.
 * Using Scripts: format, check, test
 */
export class CoderAgent extends AgentBase {
  constructor(options: CoderAgentOptions) {
    const combinedTools = [...(options.additionalTools ?? []), ...Object.values(allTools)]
    const tools = getAvailableTools({
      provider: options.provider,
      allTools: combinedTools,
      hasAgent: (options.agents?.length ?? 0) > 0,
      permissionLevel: PermissionLevel.Arbitrary,
      interactive: true,
    })
    const toolNamePrefix = 'tool_'
    const systemPrompt = fullSystemPrompt(
      {
        os: options.os,
      },
      tools,
      toolNamePrefix,
      options.customInstructions ?? [],
      options.scripts ?? {},
      options.toolFormat === 'native',
    )

    super(coderAgentInfo.name, options.ai, {
      systemPrompt,
      tools,
      toolNamePrefix,
      provider: options.provider,
      interactive: options.interactive,
      agents: options.agents,
      scripts: options.scripts,
      callback: options.callback,
      policies: options.policies,
      toolFormat: options.toolFormat,
      parameters: options.parameters ?? {},
      usageMeter: options.usageMeter ?? new UsageMeter(),
    })
  }

  protected async onBeforeInvokeTool(name: string, _args: Record<string, string>): Promise<ToolResponse | undefined> {
    // if agent is about to attemptCompletion, do format and check
    if (name !== attemptCompletion.name) {
      return
    }

    const executeCommand = this.config.provider.executeCommand
    if (!executeCommand) {
      return
    }
    // try to format the code, ignore errors
    const format = this.config.scripts?.format
    const formatCommand = typeof format === 'string' ? format : format?.command

    if (formatCommand) {
      try {
        await executeCommand(formatCommand, false)
      } catch (error) {
        console.warn(`Failed to format code using command: ${formatCommand}`, error)
      }
    }

    // try to check the code, report errors if any
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

    // try to test the code, report errors if any
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

export const coderAgentInfo = {
  name: 'coder',
  responsibilities: [
    'Editing and refactoring existing code.',
    'Creating new features or modules.',
    'Running tests and analyzing test results.',
    'Maintaining coding standards, lint rules, and general code quality.',
  ],
} as const satisfies AgentInfo
