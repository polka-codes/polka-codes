import type { Logger } from '@polka-codes/core'
import type { Command } from 'commander'
import { createLogger } from '../logger'
import type { CliOptions } from '../options'

export function getBaseWorkflowOptions(command: Command): CliOptions & { interactive: boolean; logger: Logger } {
  const globalOpts = (command.parent ?? command).opts() as CliOptions
  const verbose = globalOpts.silent ? -1 : (globalOpts.verbose ?? 0)

  const logger: Logger = createLogger({ verbose })

  return {
    ...globalOpts,
    interactive: !globalOpts.yes,
    logger,
  }
}
