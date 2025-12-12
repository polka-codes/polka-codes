import readline from 'node:readline'

export function readMultiline(prompt = 'Enter text (Ctrl+D to finish):') {
  return new Promise<string>((resolve) => {
    console.log(prompt)
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
    })

    const lines: string[] = []
    rl.on('line', (line) => {
      lines.push(line)
    })

    rl.on('close', () => {
      resolve(lines.join('\n'))
    })
  })
}
