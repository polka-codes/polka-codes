import { readFile } from 'node:fs/promises'
import { agentOptions, createPolka } from '@polka-codes/core'
import type { Command } from 'commander'
import coder from '../agents/coder'
import { parseOptions } from '../options'
import type { ExecuteCommandCallback } from '../tools/executeCommand'
import { listFiles } from '../utils/listFiles'
import { runChat } from './chat'

const readStdin = async (timeoutMs = 30000): Promise<string> => {
  if (process.stdin.isTTY) {
    return ''
  }

  return new Promise((resolve, reject) => {
    let input = ''
    let timeoutId: NodeJS.Timer | undefined = undefined

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      process.stdin.removeAllListeners()
      process.stdin.resume()
    }

    timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Stdin read timeout'))
    }, timeoutMs)

    process.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString()
    })

    process.stdin.on('end', () => {
      cleanup()
      if (!input) {
        reject(new Error('Empty stdin input'))
        return
      }
      resolve(input)
    })

    process.stdin.on('error', (err) => {
      cleanup()
      reject(err)
    })
  })
}

export async function runTask(taskArg: string | undefined, _options: any, command: Command) {
  let task = taskArg
  if (!task) {
    try {
      const stdinInput = await readStdin()
      if (stdinInput) {
        // Use stdin input as task
        task = stdinInput
      } else {
        // No stdin input, fall back to chat
        runChat(command.opts())
        return
      }
    } catch (error) {
      console.error('Error reading stdin:', error)
      process.exit(1)
    }
  }

  const { config, providerConfig, verbose, maxMessageCount, budget, agent } = parseOptions(command.opts())

  const { provider, model, apiKey } = providerConfig.getConfigForAgent(agent) ?? {}

  if (!provider || !model) {
    console.error('Provider and model must be configured')
    process.exit(1)
  }

  console.log('Provider:', provider)
  console.log('Model:', model)

  const executeCommandHandler: ExecuteCommandCallback = {
    onStarted(command) {
      console.log(`$ >>>> $ ${command}`)
    },
    onStdout(data) {
      process.stdout.write(data)
    },
    onStderr(data) {
      process.stderr.write(data)
    },
    onExit(code) {
      console.log(`$ <<<< $ Command exited with code: ${code}`)
    },
    onError(error) {
      console.log(`$ <<<< $ Command error: ${error}`)
    },
  }

  const cwd = process.cwd()
  const [fileList, limited] = await listFiles(cwd, true, 200, cwd, [])

  const polka = createPolka(
    {
      coder: agentOptions({
        info: coder({ executeCommand: executeCommandHandler }),
        model: {
          provider: provider as any,
          model,
          apiKey,
        },
        contextProvider: async (context) => {
          let ret = `<files>
${fileList.join('\n')}${limited ? '\n<files_truncated>true</files_truncated>' : ''}
</files>`
          const unreadableFiles: string[] = []
          if (context?.relevantFiles) {
            for (const file of context.relevantFiles) {
              try {
                const fileContent = await readFile(file, 'utf8')
                ret += `\n<file_content path="${file}">\n${fileContent}\n</file_content>`
              } catch (error) {
                console.warn(`Failed to read file: ${file}`, error)
                unreadableFiles.push(file)
              }
            }

            if (unreadableFiles.length > 0) {
              ret += '\n<relevant_unreadable_files>\n'
              for (const file of unreadableFiles) {
                ret += `${file}\n`
              }
              ret += '</relevant_unreadable_files>'
            }
          }
          if (context?.context) {
            ret += `\n\n${context.context}`
          }
          return ret
        },
      }),
    },
    {
      onStartTask(agentName, task, context) {
        console.log(`Agent ${agentName} started task ${task}`)
        if (context) {
          console.log(`Context: ${context}`)
        }
      },
      onToolUse(tool, args) {
        console.log(`Tool ${tool} used with args: ${JSON.stringify(args)}`)
      },
    },
  )

  const resp = await polka.startTask('coder', task)
  console.log(resp)
}
