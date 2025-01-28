import type { TaskEvent } from '@polka-codes/core'
import chalk from 'chalk'

export const printEvent = (event: TaskEvent) => {
  if (event.newText) {
    if (event.kind === 'reasoning') {
      process.stdout.write(chalk.dim(event.newText))
    } else {
      process.stdout.write(event.newText)
    }
  }
  if (event.kind === 'start_request') {
    console.log('\n\n======== New Request ========\n')
  }
  if (event.kind === 'end_request') {
    console.log('\n\n======== End Request ========\n')
  }
  if (event.kind === 'max_iterations_reached') {
    console.log('Max iterations reached')
  }
}
