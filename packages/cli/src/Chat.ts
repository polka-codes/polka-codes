import { existsSync } from 'node:fs'
import readline from 'node:readline'

export type ChatOptions = {
  onMessage: (message: string, files: string[]) => Promise<string | undefined>
  onExit: () => Promise<void>
  onInterrupt?: () => void
}

export class Chat {
  readonly #options: ChatOptions
  #rl!: readline.Interface
  #consecutiveCtrlCCount = 0
  #isMultilineMode = false
  #multilineBuffer: string[] = []
  #busy = false
  #attachedFiles = new Set<string>()

  constructor(options: ChatOptions) {
    this.#options = options
    this.#start()
  }

  #showHelp() {
    console.log(`
Available commands:
  .h, .help       - Show this help message
  .m, .multi      - Enter multiline mode (Ctrl+D to finish, Ctrl+C to cancel)
  .f, .file <path> - Attach a file to the message. To remove use .unfile <path>
  .unfile <path>  - Remove an attached file.
  .files          - List attached files.
  .e, .exit       - Exit the chat
`)
  }

  #start() {
    this.#rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    })
    this.#rl.prompt()

    this.#rl.on('line', async (input) => {
      if (input.trim() === '') {
        this.#rl.prompt()
        return
      }
      if (this.#busy) {
        // make beep sound
        process.stdout.write('\x07')
        return
      }

      this.#consecutiveCtrlCCount = 0

      const trimmedInput = input.trim()
      const [command, ...args] = trimmedInput.split(/\s+/)

      switch (command) {
        case '.h':
        case '.help':
          this.#showHelp()
          this.#rl.prompt()
          return

        case '.m':
        case '.multi':
          this.#isMultilineMode = true
          this.#multilineBuffer = []
          console.log('Entering multiline mode. Press Ctrl+D to finish, Ctrl+C to cancel.')
          this.#rl.setPrompt('... ')
          this.#rl.prompt()
          return

        case '.f':
        case '.file':
          if (args.length === 0) {
            console.log('Usage: .file <path>')
          } else {
            for (const file of args) {
              if (existsSync(file)) {
                this.#attachedFiles.add(file)
                console.log(`Attached file: ${file}`)
              } else {
                console.log(`File not found: ${file}`)
              }
            }
            if (this.#attachedFiles.size > 0) {
              this.#rl.setPrompt(`[${this.#attachedFiles.size} file(s)] > `)
            } else {
              this.#rl.setPrompt('> ')
            }
          }
          this.#rl.prompt()
          return

        case '.unfile':
          if (args.length === 0) {
            console.log('Usage: .unfile <path>')
          } else {
            for (const file of args) {
              if (this.#attachedFiles.delete(file)) {
                console.log(`Unattached file: ${file}`)
              } else {
                console.log(`File not attached: ${file}`)
              }
            }
            if (this.#attachedFiles.size > 0) {
              this.#rl.setPrompt(`[${this.#attachedFiles.size} file(s)] > `)
            } else {
              this.#rl.setPrompt('> ')
            }
          }
          this.#rl.prompt()
          return

        case '.files':
          if (this.#attachedFiles.size === 0) {
            console.log('No files attached.')
          } else {
            console.log('Attached files:')
            for (const file of this.#attachedFiles) {
              console.log(`- ${file}`)
            }
          }
          this.#rl.prompt()
          return

        case '.e':
        case '.exit':
          this.#rl.close()
          await this.#options.onExit()
          return
      }

      if (this.#isMultilineMode) {
        this.#multilineBuffer.push(input)
        this.#rl.prompt()
        return
      }

      this.#busy = true
      try {
        const files = Array.from(this.#attachedFiles)
        if (files.length > 0) {
          this.#attachedFiles.clear()
          this.#rl.setPrompt('> ')
        }
        const message = await this.#options.onMessage(input, files)
        if (message) {
          console.log(message)
        }
      } finally {
        this.#busy = false
      }
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      ;(this.#rl as any).line = ''
      this.#rl.prompt()
    })

    this.#rl.on('close', () => {
      if (this.#isMultilineMode && this.#multilineBuffer.length > 0) {
        const message = this.#multilineBuffer.join('\n')
        this.#rl.resume()
        console.log()
        const files = Array.from(this.#attachedFiles)
        if (files.length > 0) {
          this.#attachedFiles.clear()
          this.#rl.setPrompt('> ')
        }
        this.#options.onMessage(message, files)
        this.#multilineBuffer = []
        this.#isMultilineMode = false
        this.#start()
      } else {
        this.#options.onExit()
      }
    })

    this.#rl.on('SIGINT', () => {
      if (this.#busy) {
        console.log('\nAborting request...')
        this.#options.onInterrupt?.()
        return
      }

      if (this.#isMultilineMode) {
        this.#isMultilineMode = false
        this.#multilineBuffer = []
        console.log('\n')
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        this.#rl.setPrompt('> ')
        this.#rl.prompt()
        return
      }

      // If user hasn't typed anything yet
      if (this.#rl.line.length === 0) {
        this.#consecutiveCtrlCCount++
        if (this.#consecutiveCtrlCCount >= 2) {
          this.#rl.close()
          this.#options.onExit()
          return
        }
        console.log('\n(Press Ctrl+C again to exit or type .exit)')
        this.#rl.prompt()
      } else {
        console.log()
        // Clear the currently typed text and show a fresh prompt
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        ;(this.#rl as any).line = ''
        this.#rl.prompt()
      }
    })
  }

  close() {
    this.#rl.close()
  }
}
