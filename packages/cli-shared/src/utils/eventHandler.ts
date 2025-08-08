import { type TaskEvent, TaskEventKind, ToolResponseType, type UsageMeter } from '@polka-codes/core'
import chalk from 'chalk'

type ToolStat = { calls: number; success: number; errors: number }
const toolCallStats = new Map<string, ToolStat>()

export const printEvent = (verbose: number, usageMeter: UsageMeter, customConsole: Console = console) => {
  let hadReasoning = false
  return (event: TaskEvent) => {
    switch (event.kind) {
      case TaskEventKind.StartTask:
        toolCallStats.clear()
        if (verbose > 1) {
          customConsole.log(`\n====== System Prompt ======\n${event.systemPrompt}`)
          customConsole.log('\n\n================\n')
        }
        break
      case TaskEventKind.StartRequest:
        customConsole.log('\n\n======== New Request ========\n')

        if (verbose) {
          const userMessage = event.userMessage.content
          if (typeof userMessage === 'string') {
            customConsole.log(userMessage)
          } else {
            for (const content of userMessage) {
              switch (content.type) {
                case 'text':
                  customConsole.log(content.text)
                  break
                case 'image':
                  if (content.image instanceof URL) {
                    customConsole.log(chalk.yellow(`[Image content from URL: ${content.image}]`))
                  } else {
                    customConsole.log(chalk.yellow(`[Image content: ${content.mediaType}]`))
                  }
                  break
                case 'file':
                  customConsole.log(chalk.yellow(`[File name: ${content.filename}, type: ${content.mediaType}]`))
                  break
                case 'tool-call':
                  customConsole.log(chalk.yellow(`[Tool call: ${content.toolName}]`))
                  break
                case 'tool-result':
                  customConsole.log(chalk.yellow(`[Tool result: ${content.toolName}]`))
                  if (verbose > 0) {
                    customConsole.log(content.output)
                  }
                  break
                case 'reasoning':
                  break
              }
            }
          }
          customConsole.log('\n\n======== Request Message Ended ========\n')
        }
        break
      case TaskEventKind.EndRequest:
        customConsole.log('\n\n======== Request Ended ========\n')

        if (verbose) {
          usageMeter.printUsage(customConsole)
        }

        break
      case TaskEventKind.Usage:
        break
      case TaskEventKind.Text:
        if (customConsole !== console) {
          break
        }
        if (hadReasoning) {
          process.stdout.write('\n\n')
          hadReasoning = false
        }
        process.stdout.write(event.newText)
        break
      case TaskEventKind.Reasoning:
        if (customConsole !== console) {
          break
        }
        process.stdout.write(chalk.dim(event.newText))
        hadReasoning = true
        break
      case TaskEventKind.ToolUse: {
        customConsole.log(chalk.yellow('\n\nTool use:', event.tool), event.content)
        const stats = toolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
        stats.calls++
        toolCallStats.set(event.tool, stats)
        break
      }
      case TaskEventKind.ToolReply: {
        const stats = toolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
        stats.success++
        toolCallStats.set(event.tool, stats)
        break
      }
      case TaskEventKind.ToolInvalid:
        break
      case TaskEventKind.ToolError: {
        customConsole.error(chalk.red('\n\nTool error:', event.tool))
        customConsole.error(chalk.red(event.content))
        const stats = toolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
        stats.errors++
        toolCallStats.set(event.tool, stats)
        break
      }
      case TaskEventKind.ToolInterrupted:
        break
      case TaskEventKind.ToolHandOver:
        customConsole.log('\n\n======== Task Handed Over ========\n')
        customConsole.log('Agent:', event.agentName)
        customConsole.log('Task:', event.task)
        customConsole.log('Context:', event.context)
        customConsole.log('Files:', event.files)
        customConsole.log()
        break
      case TaskEventKind.ToolDelegate:
        customConsole.log('\n\n======== Task Delegated ========\n')
        customConsole.log('Agent:', event.agentName)
        customConsole.log('Task:', event.task)
        customConsole.log('Context:', event.context)
        customConsole.log('Files:', event.files)
        customConsole.log()
        break
      case TaskEventKind.UsageExceeded:
        customConsole.log('\n\n======= Usage Exceeded ========\n')
        break
      case TaskEventKind.EndTask:
        customConsole.log('\n\n======== Task Ended ========\n')
        customConsole.log('Reason:', event.exitReason.type)
        switch (event.exitReason.type) {
          case ToolResponseType.Exit:
            customConsole.log('Exit Message:', event.exitReason.message)
            break
          case ToolResponseType.Interrupted:
            customConsole.log('Interrupted Message:', event.exitReason.message)
            break
        }
        customConsole.log('\n\n======== Tool Call Stats ========')
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
          customConsole.table(tableData)
        } else {
          customConsole.log('No tools were called.')
        }
        break
    }
  }
}
