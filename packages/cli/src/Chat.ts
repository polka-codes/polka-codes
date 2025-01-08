import readline from 'node:readline'

export type ChatOptions = {
  onMessage: (message: string) => Promise<string | undefined>
  onExit: () => Promise<void>
}

export class Chat {
  readonly #options: ChatOptions
  #rl!: readline.Interface
  #consecutiveCtrlCCount = 0
  #isMultilineMode = false
  #multilineBuffer: string[] = []
  #busy = false

  constructor(options: ChatOptions) {
    this.#options = options
    this.#start()
  }

  #showHelp() {
    console.log(`
Available commands:
  .h, .help       - Show this help message
  .m, .multi      - Enter multiline mode (Ctrl+D to finish, Ctrl+C to cancel)
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

      switch (trimmedInput) {
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
        const message = await this.#options.onMessage(input)
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
        this.#options.onMessage(message)
        this.#multilineBuffer = []
        this.#isMultilineMode = false
        this.#start()
      } else {
        this.#options.onExit()
      }
    })

    this.#rl.on('SIGINT', () => {
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
