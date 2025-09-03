import { getAvailableTools } from '../../getAvailableTools'
import { type ToolResponse, ToolResponseType } from '../../tool'
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
      interactive: true,
    })
    const toolNamePrefix = options.toolFormat === 'native' ? '' : 'tool_'
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
      agents: options.agents,
      scripts: options.scripts,
      callback: options.callback,
      policies: options.policies,
      toolFormat: options.toolFormat,
      parameters: options.parameters ?? {},
      usageMeter: options.usageMeter ?? new UsageMeter(),
      requestTimeoutSeconds: options.requestTimeoutSeconds,
      requireToolUse: options.requireToolUse ?? true,
    })
  }

  async #runScript(
    scriptName: keyof NonNullable<CoderAgentOptions['scripts']>,
    shouldReplyWithError: boolean,
  ): Promise<ToolResponse | undefined> {
    const executeCommand = this.config.provider.executeCommand
    if (!executeCommand) {
      return
    }
    const script = this.config.scripts?.[scriptName]
    const command = typeof script === 'string' ? script : script?.command

    if (command) {
      try {
        const { exitCode, stdout, stderr } = await executeCommand(command, false)
        if (exitCode !== 0 && shouldReplyWithError) {
          return {
            type: ToolResponseType.Reply,
            message: {
              type: 'error-text',
              value: responsePrompts.commandResult(command, exitCode, stdout, stderr),
            },
          }
        }
      } catch (error) {
        console.warn(`Failed to run ${scriptName} using command: ${command}`, error)
      }
    }
  }

  protected async onBeforeInvokeTool(name: string, _args: Record<string, string>): Promise<ToolResponse | undefined> {
    // if agent is about to attemptCompletion, do format and check
    if (name !== attemptCompletion.name) {
      return
    }

    await this.#runScript('format', false)

    const checkResult = await this.#runScript('check', true)
    if (checkResult) {
      return checkResult
    }

    const testResult = await this.#runScript('test', true)
    if (testResult) {
      return testResult
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
