/**
 * Shared utilities for command-line command handlers
 */

import type { Logger } from '@polka-codes/core'
import type { Command } from 'commander'
import { createLogger } from '../logger'
import type { CliOptions } from '../options'

/**
 * Get global options from the command hierarchy
 * Handles both top-level commands and subcommands
 *
 * @param command - The commander Command instance
 * @returns Global options object
 *
 * @example
 * ```ts
 * export async function runCommand(options, command: Command) {
 *   const globalOpts = getGlobalOptions(command)
 *   const { verbose, yes } = globalOpts
 * }
 * ```
 */
export function getGlobalOptions(command: Command): CliOptions {
  return (command.parent ?? command).opts() as CliOptions
}

/**
 * Get base workflow options with standard defaults
 * This provides consistent interactive mode handling across all commands
 *
 * @param command - The commander Command instance
 * @returns Workflow options with interactive mode set based on --yes flag
 *
 * @example
 * ```ts
 * const workflowOpts = getBaseWorkflowOptions(command)
 * await code({
 *   task: '...',
 *   ...workflowOpts
 * })
 * ```
 */
export function getBaseWorkflowOptions(command: Command): CliOptions & { interactive: boolean; logger: Logger } {
  const globalOpts = getGlobalOptions(command)
  const verbose = globalOpts.silent ? -1 : (globalOpts.verbose ?? 0)

  // Create logger
  const logger: Logger = createLogger({ verbose })

  return {
    interactive: !globalOpts.yes,
    ...globalOpts,
    logger,
  }
}
