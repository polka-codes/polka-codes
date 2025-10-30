// packages/cli/src/utils/userInput.ts
import { confirm, input } from '@inquirer/prompts'
import { readMultiline } from '@polka-codes/cli-shared'
import chalk from 'chalk'
import { UserCancelledError } from '../errors'

export async function getUserInput(
  message: string,
  options: { default?: string; throwOnCancel?: boolean } = {},
): Promise<string | undefined> {
  const { default: defaultValue, throwOnCancel = false } = options
  try {
    let result = await input({
      message: `${message}${chalk.gray(' (type .m for multiline)')}`,
      default: defaultValue,
    })
    if (result === '.m') {
      result = await readMultiline('Enter multiline text (Ctrl+D to finish):')
    }
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      if (throwOnCancel) {
        throw new UserCancelledError()
      }
      return undefined
    }
    throw error
  }
}

export async function getConfirmation(message: string, options: { default?: boolean; throwOnCancel?: boolean } = {}): Promise<boolean> {
  const { default: defaultValue = true, throwOnCancel = false } = options
  try {
    const result = await confirm({
      message,
      default: defaultValue,
    })
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      if (throwOnCancel) {
        throw new UserCancelledError()
      }
      return false
    }
    throw error
  }
}
