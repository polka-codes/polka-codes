import * as core from '@actions/core'
import * as github from '@actions/github'

import { AiServiceProvider, createService } from '@polka-codes/core'

async function run(): Promise<void> {
  try {
    const service = createService(AiServiceProvider.Anthropic, {
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    core.info(`Running Polka Action with service: ${service.constructor.name}`)

    const context = github.context
    core.info(`Event name: ${context.eventName}`)
    core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}

run()
