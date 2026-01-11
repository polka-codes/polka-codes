import { Console } from 'node:console'
import type { Writable } from 'node:stream'
import { type TaskEvent, TaskEventKind, type UsageMeter } from '@polka-codes/core'
import chalk from 'chalk'
import { simplifyToolParameters } from './parameterSimplifier'

type ToolStat = { calls: number; success: number; errors: number }
const taskToolCallStats = new Map<string, ToolStat>()
const globalToolCallStats = new Map<string, ToolStat>()

export function logToolCallStats(stream: Writable, statsMap: Map<string, ToolStat>, title: string) {
  const customConsole = new Console(stream, stream) as globalThis.Console
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
const mergeToolCallStats = (a: Map<string, ToolStat>, b: Map<string, ToolStat>) => {
  const merged = new Map<string, ToolStat>()
  for (const [tool, stat] of a) {
    merged.set(tool, { ...stat })
  }

  for (const [tool, stat] of b) {
    const existing = merged.get(tool)
    if (existing) {
      existing.calls += stat.calls
      existing.success += stat.success
      existing.errors += stat.errors
    } else {
      merged.set(tool, { ...stat })
    }
  }
  return merged
}

export function logGlobalToolCallStats(stream: Writable) {
  const merged = mergeToolCallStats(globalToolCallStats, taskToolCallStats)

  logToolCallStats(stream, merged, 'Global Tool Call Stats')
}

export const printEvent = (verbose: number, usageMeter: UsageMeter, stream: Writable = process.stdout) => {
  if (verbose < 0) {
    return (_event: TaskEvent) => {}
  }
  const customConsole = new Console(stream, stream) as globalThis.Console
  let hadReasoning = false
  let hasText = false
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
        hasText = false
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

        if (verbose === 0 && hasText) {
          write('\n\n')
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
        if (event.newText.trim().length > 0) {
          hasText = true
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
          const params = verbose > 1 ? event.params : simplifyToolParameters(event.tool, event.params)
          customConsole.log(chalk.yellow('\n\nTool use:', event.tool), params)
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
          case 'Error': {
            const { error } = event.exitReason
            customConsole.error(chalk.red(`Workflow failed: ${error.message}`))
            if (verbose > 0 && error.stack) {
              customConsole.error(chalk.red(error.stack))
            }
            break
          }
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
        taskToolCallStats.clear()
        break
    }
  }
}
