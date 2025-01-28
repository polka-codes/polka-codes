import { type TaskEvent, TaskEventKind } from '@polka-codes/core'
import chalk from 'chalk'

export const printEvent = (event: TaskEvent) => {
  switch (event.kind) {
    case TaskEventKind.StartRequest:
      console.log('\n\n======== New Request ========\n')
      break
    case TaskEventKind.EndRequest:
      console.log('\n\n======== Request Ended ========\n')
      break
    case TaskEventKind.Usage:
      break
    case TaskEventKind.Text:
      process.stdout.write(event.newText)
      break
    case TaskEventKind.Reasoning:
      process.stdout.write(chalk.dim(event.newText))
      break
    case TaskEventKind.ToolUse:
      break
    case TaskEventKind.ToolReply:
      break
    case TaskEventKind.ToolInvalid:
      break
    case TaskEventKind.ToolError:
      break
    case TaskEventKind.ToolInterrupted:
      break
    case TaskEventKind.ToolHandOver:
      console.log('\n\n======== Task Handed Over ========\n')
      console.log('Agent:', event.agentName)
      console.log('Task:', event.task)
      console.log()
      break
    case TaskEventKind.MaxIterationsReached:
      console.log('Max iterations reached')
      break
    case TaskEventKind.EndTask:
      break
  }
}
