import { execSync, spawnSync } from 'node:child_process'
import { confirm } from '@inquirer/prompts'
import { streamText } from 'ai'
import { Command } from 'commander'
import ora from 'ora'

import { UsageMeter, getModel } from '@polka-codes/core'
import { parseOptions } from '../options'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const spinner = ora('Gathering information...').start()

    const options = command.parent?.opts() ?? {}
    const { providerConfig } = parseOptions(options)

    const { provider, model, apiKey } = providerConfig.getConfigForCommand('commit') ?? {}

    console.log('Provider:', provider)
    console.log('Model:', model)

    if (!provider || !model) {
      console.error('Error: No provider specified. Please run "pokla config" to configure your AI provider.')
      process.exit(1)
    }

    const usage = new UsageMeter()

    try {
      // Check if there are any staged files
      const status = execSync('git status --porcelain').toString()
      const stagedFiles = status.split('\n').filter((line) => line.match(/^[MADRC]/))

      // Handle no staged files case
      if (stagedFiles.length === 0) {
        if (localOptions.all) {
          // Stage all files
          execSync('git add .')
        } else {
          spinner.stopAndPersist()
          // wait for 10ms to let the spinner stop
          await new Promise((resolve) => setTimeout(resolve, 10))
          const addAll = await confirm({
            message: 'No staged files found. Do you want to stage all files?',
          })
          spinner.start()
          if (addAll) {
            execSync('git add .')
          } else {
            console.error('Error: No files to commit')
            process.exit(1)
          }
        }
      }

      // Get diff with some context
      const diff = execSync('git diff --cached -U50').toString()

      spinner.text = 'Generating commit message...'

      // Generate commit message
      // use streamText so it is possible to get openrouter genId
      const stream = streamText({
        model: getModel({
          provider: provider as any,
          model,
          apiKey,
        }),
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: `<tool_diff>
${diff}
</tool_diff>
<tool_context>
${message}
</tool_context>`,
          },
        ],
      })

      // consume the stream but ignore the output
      for await (const _ of stream.textStream) {
      }

      // TODO: bake this code into usage meter
      // const resp = await stream.response
      // const genId = resp.id
      // const controller = new AbortController()
      // const timeout = setTimeout(() => controller.abort(), 5000) // 5 seconds
      // const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
      //   headers: {
      //     Authorization: `Bearer ${apiKey}`,
      //   },
      //   signal: controller.signal, // this request hangs sometimes
      // })
      // const responseBody = await response.json()

      // console.log(responseBody)

      const streamUsage = await stream.usage
      usage.addUsage({
        inputTokens: streamUsage.promptTokens,
        outputTokens: streamUsage.completionTokens,
      })
      usage.printUsage()

      spinner.succeed('Commit message generated')

      const commitMessage = await stream.text

      console.log(`\nCommit message:\n${commitMessage}`)

      // Make the commit
      try {
        spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' })
      } catch {
        console.error('Error: Commit failed')
        process.exit(1)
      }
    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    }
  })

const prompt = `
You are an advanced assistant specialized in creating concise and accurate Git commit messages. When you receive:
- A Git diff inside the <tool_input> tag.
- Additional user-supplied context inside the <tool_input_context> tag (if any).

You will produce a single commit message. The commit message must accurately reflect the changes shown in the diff and should be clear, descriptive, and devoid of unnecessary or repeated information. If a context is provided, it MUST be incorporated into the commit message.
`
