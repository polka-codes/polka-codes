import { type TaskEvent, TaskEventKind } from '@polka-codes/core'
import chalk from 'chalk'

export const printEvent = (verbose: number) => (event: TaskEvent) => {
  let hadReasoning = false

  switch (event.kind) {
    case TaskEventKind.StartTask:
      if (verbose > 1) {
        console.log(`\n====== System Prompt ======\n${event.systemPrompt}`)
        console.log('\n\n================\n')
      }
      break
    case TaskEventKind.StartRequest:
      console.log('\n\n======== New Request ========\n')

      if (verbose) {
        console.log(event.userMessage)
        console.log('\n\n======== Request Message Ended ========\n')
      }
      break
    case TaskEventKind.EndRequest:
      console.log('\n\n======== Request Ended ========\n')
      break
    case TaskEventKind.Usage:
      break
    case TaskEventKind.Text:
      if (hadReasoning) {
        process.stdout.write('\n\n')
        hadReasoning = false
      }
      process.stdout.write(event.newText)
      break
    case TaskEventKind.Reasoning:
      process.stdout.write(chalk.dim(event.newText))
      hadReasoning = true
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
      console.log('Context:', event.context)
      console.log('Files:', event.files)
      console.log()
      break
    case TaskEventKind.ToolDelegate:
      console.log('\n\n======== Task Delegated ========\n')
      console.log('Agent:', event.agentName)
      console.log('Task:', event.task)
      console.log('Context:', event.context)
      console.log('Files:', event.files)
      console.log()
      break
    case TaskEventKind.UsageExceeded:
      console.log('\n\n======= Usage Exceeded ========\n')
      break
    case TaskEventKind.EndTask:
      break
  }
}
