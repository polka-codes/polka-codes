/**
 * Task command implementation
 * Generated by polka.codes
 */

import { ToolResponseType } from '@polka-codes/core'
import type { Command } from 'commander'
import { Runner } from '../Runner'
import { parseOptions } from '../options'
import { printEvent } from '../utils/eventHandler'
import { runChat } from './chat'

export async function runTask(task: string | undefined, _options: any, command: Command) {
  const { config, providerConfig, verbose } = parseOptions(command.opts())
  const { provider, model, apiKey } = providerConfig.getConfigForCommand('task') ?? {}

  if (!provider || !model) {
    console.error('Provider and model must be configured')
    process.exit(1)
  }

  if (!task) {
    // do chat
    await runChat({}, command)
    return
  }

  const runner = new Runner({
    provider,
    model,
    apiKey,
    config,
    maxMessageCount: 100, // TODO: Make configurable
    budget: 10, // TODO: Make configurable
    interactive: process.stdin.isTTY,
    eventCallback: printEvent(verbose),
    enableCache: true,
  })

  if (task) {
    const [exitReason, info] = await runner.startTask(task)

    switch (exitReason.type) {
      case 'UsageExceeded':
        console.error('Task failed: Usage limit exceeded')
        process.exit(1)
        break
      case 'WaitForUserInput':
        // Normal exit waiting for user input
        break
      case ToolResponseType.Exit:
        // Task completed successfully
        break
      case ToolResponseType.Interrupted:
        console.error('Task interrupted:', exitReason.message)
        process.exit(1)
        break
      case ToolResponseType.HandOver:
        // Task handed over to another agent
        break
    }

    runner.printUsage()
  }
}
