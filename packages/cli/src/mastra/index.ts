import { createPolka } from '@polka-codes/core'
import coder from '../agents/coder'
import { parseOptions } from '../options'
import type { ExecuteCommandCallback } from '../tools/executeCommand'

const executeCommandHandler: ExecuteCommandCallback = {
  onStarted(command) {
    console.log(`$ >>>> $ ${command}`)
  },
  onStdout(data) {
    process.stdout.write(data)
  },
  onStderr(data) {
    process.stderr.write(data)
  },
  onExit(code) {
    console.log(`$ <<<< $ Command exited with code: ${code}`)
  },
  onError(error) {
    console.log(`$ <<<< $ Command error: ${error}`)
  },
}

const { providerConfig } = parseOptions({})

const { provider, model, apiKey } = providerConfig.getConfigForAgent('coder') ?? {}

if (!provider || !model) {
  console.error('Provider and model must be configured')
  process.exit(1)
}

const pokla = createPolka(
  {
    coder: {
      info: coder({ executeCommand: executeCommandHandler }),
      model: {
        provider: provider as any,
        model,
        apiKey,
      },
      contextProvider: async (context) => {
        return ''
      },
    },
  },
  {
    onStartTask(agentName, task, context) {
      console.log(`Agent ${agentName} started task ${task}`)
      if (context) {
        console.log(`Context: ${context}`)
      }
    },
    onToolUse(tool, args) {
      console.log(`Tool ${tool} used with args: ${JSON.stringify(args)}`)
    },
  },
)

export const mastra = pokla.mastra
