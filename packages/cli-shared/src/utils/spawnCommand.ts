import { spawn } from 'node:child_process'

/** Undefined arguments select a shell; an array passes arguments literally. */
export function spawnCommand(command: string, args?: string[], signal?: AbortSignal) {
  signal?.throwIfAborted()
  const processGroup = signal !== undefined && process.platform !== 'win32'
  const child = spawn(command, args ?? [], {
    shell: args === undefined,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: processGroup,
    signal,
  })

  const pid = child.pid
  if (processGroup && signal && pid !== undefined) {
    const abort = () => {
      try {
        // Killing only the shell leaves commands such as build tools running.
        process.kill(-pid, 'SIGTERM')
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) child.emit('error', error)
      }
    }
    signal.addEventListener('abort', abort, { once: true })
    child.once('close', () => signal.removeEventListener('abort', abort))
  }
  return child
}
