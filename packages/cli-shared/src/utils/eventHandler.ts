import { type TaskEvent, TaskEventKind, ToolResponseType, type UsageMeter } from '@polka-codes/core'
import chalk from 'chalk'

type ToolStat = { calls: number; success: number; errors: number }
const toolCallStats = new Map<string, ToolStat>()

export const printEvent = (verbose: number, usageMeter: UsageMeter) => {
  let hadReasoning = false
  return (event: TaskEvent) => {
    switch (event.kind) {
      case TaskEventKind.StartTask:
        toolCallStats.clear()
        if (verbose > 1) {
          console.log(`\n====== System Prompt ======\n${event.systemPrompt}`)
          console.log('\n\n================\n')
        }
        break
      case TaskEventKind.StartRequest:
        console.log('\n\n======== New Request ========\n')

        if (verbose) {
          const { userMessage } = event
          if (typeof userMessage === 'string') {
            console.log(userMessage)
          } else {
            for (const content of userMessage) {
              switch (content.type) {
                case 'text':
                  console.log(content.text)
                  break
                case 'image':
                  if (content.image instanceof URL) {
                    console.log(chalk.yellow(`[Image content from URL: ${content.image}]`))
                  } else {
                    console.log(chalk.yellow(`[Image content: ${content.mediaType}]`))
                  }
                  break
                case 'file':
                  console.log(chalk.yellow(`[File name: ${content.filename}, type: ${content.mediaType}]`))
                  break
                default:
                  console.log(chalk.red('[Unknown content type]'))
                  console.log(content)
              }
            }
          }
          console.log('\n\n======== Request Message Ended ========\n')
        }
        break
      case TaskEventKind.EndRequest:
        console.log('\n\n======== Request Ended ========\n')

        if (verbose) {
          usageMeter.printUsage()
        }

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
        {
          const stats = toolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
          stats.calls++
          toolCallStats.set(event.tool, stats)
        }
        break
      case TaskEventKind.ToolReply:
        {
          const stats = toolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
          stats.success++
          toolCallStats.set(event.tool, stats)
        }
        break
      case TaskEventKind.ToolInvalid:
        break
      case TaskEventKind.ToolError:
        {
          const stats = toolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
          stats.errors++
          toolCallStats.set(event.tool, stats)
        }
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
        console.log('\n\n======== Task Ended ========\n')
        console.log('Reason:', event.exitReason.type)
        switch (event.exitReason.type) {
          case ToolResponseType.Exit:
            console.log('Exit Message:', event.exitReason.message)
            break
          case ToolResponseType.Interrupted:
            console.log('Interrupted Message:', event.exitReason.message)
            break
        }
        console.log('\n\n======== Tool Call Stats ========')
        if (toolCallStats.size > 0) {
          const tableData = [...toolCallStats.entries()].map(([tool, stats]) => {
            const successRate = stats.calls > 0 ? (stats.success / stats.calls) * 100 : 0
            return {
              'Tool Name': tool,
              Calls: stats.calls,
              Success: stats.success,
              Errors: stats.errors,
              'Success Rate': `${successRate.toFixed(2)}%`,
            }
          })
          console.table(tableData)
        } else {
          console.log('No tools were called.')
        }
        break
    }
  }
}
