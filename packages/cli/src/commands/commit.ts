import { spawnSync } from 'node:child_process'
import os from 'node:os'
import { getProvider, type ProviderOptions, printEvent } from '@polka-codes/cli-shared'
import {
  type AgentStepSpec,
  combineHandlers,
  customStepSpecHandler,
  EnableCachePolicy,
  makeAgentStepSpecHandler,
  run,
  sequentialStepSpecHandler,
  UsageMeter,
  type WorkflowContext,
} from '@polka-codes/core'
import { Command } from 'commander'
import { merge } from 'lodash'
import ora from 'ora'
import { getModel } from '../getModel'
import { parseOptions } from '../options'
import prices from '../prices'
import { type CommitWorkflowContext, commitWorkflow } from '../workflows'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const options = command.parent?.opts() ?? {}
    const { providerConfig, config, verbose } = parseOptions(options)

    const commandConfig = providerConfig.getConfigForCommand('commit')

    if (!commandConfig || !commandConfig.provider || !commandConfig.model) {
      console.error('Error: No provider specified. Please run "polka config" to configure your AI provider.')
      process.exit(1)
    }

    console.log('Provider:', commandConfig.provider)
    console.log('Model:', commandConfig.model)

    const agentStepHandler = makeAgentStepSpecHandler(async (_step: AgentStepSpec, _context: WorkflowContext) => {
      const commandConfig = providerConfig.getConfigForCommand('commit')
      if (!commandConfig || !commandConfig.provider || !commandConfig.model) {
        throw new Error('No provider specified for the agent step.')
      }
      return getModel(commandConfig)
    })

    const coreStepHandler = combineHandlers(customStepSpecHandler, sequentialStepSpecHandler, agentStepHandler)

    const spinner = ora({ text: 'Gathering information...', stream: process.stderr }).start()

    const usage = new UsageMeter(merge(prices, config.prices ?? {}), { maxMessages: config.maxMessageCount, maxCost: config.budget })
    const onEvent = verbose > 0 ? printEvent(verbose, usage, console) : undefined
    const toolProviderOptions: ProviderOptions = { excludeFiles: config.excludeFiles }
    const toolProvider = getProvider(toolProviderOptions)

    const agentConfig = providerConfig.getConfigForCommand('commit')

    const contextForWorkflow: CommitWorkflowContext = {
      ui: { spinner },
      provider: toolProvider,
      parameters: {
        toolFormat: config.toolFormat,
        os: os.platform(),
        policies: [EnableCachePolicy],
        modelParameters: agentConfig?.parameters,
        scripts: config.scripts,
        retryCount: config.retryCount,
        requestTimeoutSeconds: config.requestTimeoutSeconds,
      },
      verbose,
      agentCallback: onEvent,
      logger: console,
    }

    const input = { ...(localOptions.all && { all: true }), ...(message && { context: message }) }

    try {
      const result = await run(commitWorkflow, contextForWorkflow, coreStepHandler, input)
      if (result.type === 'success') {
        const commitMessage = result.output.commitMessage
        // Make the commit
        try {
          spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' })
        } catch (error) {
          console.error('Error: Commit failed', error)
          process.exit(1)
        }
      } else if (result.type === 'error') {
        if (result.error?.message === 'User cancelled') {
          spinner.stop()
          process.exit(130)
        }
        spinner.fail(`Error generating commit message: ${result.error?.message ?? 'An unknown error occurred'}`)
        if (result.error) {
          console.error(result.error)
        }
        process.exit(1)
      }
    } catch (error) {
      spinner.fail(`Error generating commit message: ${error instanceof Error ? error.message : String(error)}`)
      console.error(error)
      process.exit(1)
    } finally {
      usage.printUsage()
    }
  })
