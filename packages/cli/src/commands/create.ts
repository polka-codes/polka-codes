/**
 * Create new project command.
 * Generated by polka.codes
 */

import { existsSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { confirm, input } from '@inquirer/prompts'
import { architectAgentInfo, coderAgentInfo, createNewProject } from '@polka-codes/core'
import { Command } from 'commander'
import { ApiProviderConfig } from '../ApiProviderConfig'
import { configPrompt } from '../configPrompt'
import type { AiProvider } from '../getModel'
import { parseOptions } from '../options'
import { Runner } from '../Runner'

const askForPath = async (projectName: string) => {
  let targetPath = join(process.cwd(), projectName)
  while (true) {
    const confirmPath = await confirm({
      message: `Do you want to create project at ${targetPath}?`,
      default: true,
    })

    if (confirmPath) {
      if (existsSync(targetPath)) {
        // check if it's a directory
        const targetStat = await stat(targetPath)
        if (targetStat.isDirectory()) {
          const confirmPath = await confirm({
            message: `Directory ${targetPath} already exists. Do you want to overwrite it?`,
            default: true,
          })

          if (confirmPath) {
            return targetPath
          }
        } else {
          console.error('Target path is not a directory')
        }
      } else {
        return targetPath
      }
    }

    const inputPath = await input({ message: 'Please provide a new path:', default: targetPath })
    targetPath = inputPath.trim()
  }
}

export const createCommand = new Command('create')
  .description('Create a new project')
  .argument('[name]', 'Project name')
  .action(async (name: string | undefined, _options: any, command: Command) => {
    const cmdOptions = command.parent?.opts() ?? {}
    const { providerConfig, maxMessageCount, verbose, budget } = parseOptions(cmdOptions)

    let { provider: maybeProvider, model, apiKey } = providerConfig.getConfigForAgent('architect') ?? {}

    if (!maybeProvider) {
      // new user? ask for config
      const newConfig = await configPrompt({})
      maybeProvider = newConfig.provider
      model = newConfig.model
      apiKey = newConfig.apiKey
    }
    const provider = maybeProvider as AiProvider

    let projectName = name

    // Get project name if not provided
    if (!projectName) {
      const inputName = await input({ message: 'What would you like to name your project?' })
      projectName = inputName.trim()
    }

    // Build target path
    const targetPath = await askForPath(projectName)

    // Create project directory
    try {
      await mkdir(targetPath, { recursive: true })
    } catch (error) {
      console.error(`Failed to create directory: ${targetPath}`, error)
      process.exit(1)
    }

    // Change working directory
    process.chdir(targetPath)

    const runner = new Runner({
      providerConfig: new ApiProviderConfig({ defaultProvider: provider, defaultModel: model, providers: { [provider]: { apiKey } } }),
      config: {},
      maxMessageCount,
      budget,
      interactive: true,
      verbose,
      availableAgents: [architectAgentInfo, coderAgentInfo],
    })

    // Start project creation
    await createNewProject(runner.multiAgent, projectName)
  })
