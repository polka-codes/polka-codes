import { Console } from 'node:console'
import type { Writable } from 'node:stream'
import { ToolResponseType, type UsageMeter } from '@polka-codes/core'
import { type TaskEvent, TaskEventKind } from '@polka-codes/workflow'
import chalk from 'chalk'

type ToolStat = { calls: number; success: number; errors: number }
const taskToolCallStats = new Map<string, ToolStat>()
const globalToolCallStats = new Map<string, ToolStat>()

export function logToolCallStats(stream: Writable, statsMap: Map<string, ToolStat>, title: string) {
  const customConsole = new Console(stream, stream)
  customConsole.log(`\n\n======== ${title} ========`)
  if (statsMap.size > 0) {
    const tableData = [...statsMap.entries()].map(([tool, stats]) => {
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
}

export function logGlobalToolCallStats(stream: Writable) {
  logToolCallStats(stream, globalToolCallStats, 'Global Tool Call Stats')
}

export const printEvent = (verbose: number, usageMeter: UsageMeter, stream: Writable = process.stdout) => {
  if (verbose < 0) {
    return () => {}
  }
  const customConsole = new Console(stream, stream)
  let hadReasoning = false
  const write = stream.write.bind(stream)
  return (event: TaskEvent) => {
    switch (event.kind) {
      case TaskEventKind.StartTask:
        taskToolCallStats.clear()
        if (verbose > 2) {
          customConsole.log(`\n====== System Prompt ======\n${event.systemPrompt}`)
          customConsole.log('\n\n================\n')
        }
        break
      case TaskEventKind.StartRequest:
        if (verbose > 0) {
          customConsole.log('\n\n======== New Request ========\n')
        }

        if (verbose > 1) {
          for (const message of event.userMessage) {
            const userMessage = message.content
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
                    if (verbose > 1) {
                      customConsole.log(content.output)
                    }
                    break
                  case 'reasoning':
                    break
                }
              }
            }
          }
          customConsole.log('\n\n======== Request Message Ended ========\n')
        }
        break
      case TaskEventKind.EndRequest:
        if (verbose > 0) {
          customConsole.log('\n\n======== Request Ended ========\n')
        }

        if (verbose > 1) {
          customConsole.log(usageMeter.getUsageText())
        }

        break
      case TaskEventKind.Text: {
        if (hadReasoning) {
          write('\n\n')
          hadReasoning = false
        }
        write(event.newText)
        break
      }
      case TaskEventKind.Reasoning: {
        if (verbose > 0) {
          write(chalk.dim(event.newText))
          hadReasoning = true
        }
        break
      }
      case TaskEventKind.ToolUse: {
        if (verbose > 0) {
          customConsole.log(chalk.yellow('\n\nTool use:', event.tool), event.params)
        }
        const stats = taskToolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
        stats.calls++
        taskToolCallStats.set(event.tool, stats)
        break
      }
      case TaskEventKind.ToolReply: {
        const stats = taskToolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
        stats.success++
        taskToolCallStats.set(event.tool, stats)
        break
      }
      case TaskEventKind.ToolError: {
        customConsole.error(chalk.red('\n\nTool error:', event.tool))
        customConsole.error(event.error)
        const stats = taskToolCallStats.get(event.tool) ?? { calls: 0, success: 0, errors: 0 }
        stats.errors++
        taskToolCallStats.set(event.tool, stats)
        break
      }
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
        }
        for (const [tool, taskStats] of taskToolCallStats.entries()) {
          const globalStats = globalToolCallStats.get(tool) ?? { calls: 0, success: 0, errors: 0 }
          globalStats.calls += taskStats.calls
          globalStats.success += taskStats.success
          globalStats.errors += taskStats.errors
          globalToolCallStats.set(tool, globalStats)
        }
        if (verbose > 0) {
          logToolCallStats(stream, taskToolCallStats, 'Task Tool Call Stats')
        }
        break
    }
  }
}
