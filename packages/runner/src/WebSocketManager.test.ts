import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'
import { parse } from 'yaml'
import { z } from 'zod'
import type { WsOutgoingMessage } from './types'
import { normalizeRunnerApiUrl, WebSocketManager } from './WebSocketManager'

const workflowSchema = z.object({
  on: z.object({
    repository_dispatch: z.object({
      types: z.array(z.string()),
    }),
  }),
})

function waitForServerPort(server: WebSocketServer): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.once('listening', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Expected websocket server to listen on a TCP port'))
        return
      }
      resolve(address.port)
    })
  })
}

function closeServer(server: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

describe('remote runner workflow dispatch', () => {
  test('uses only the app-side remote-runner-session event', async () => {
    const workflow = workflowSchema.parse(parse(await readFile(join(process.cwd(), '.github/workflows/polka-codes-runner.yml'), 'utf8')))

    expect(workflow.on.repository_dispatch.types).toContain('remote-runner-session')
    expect(workflow.on.repository_dispatch.types).not.toContain('trigger_remote_runner')
  })
})

describe('normalizeRunnerApiUrl', () => {
  test('normalizes app origins to the runner websocket endpoint', () => {
    expect(normalizeRunnerApiUrl('https://polka.codes')).toBe('wss://polka.codes/api/ws/runner')
    expect(normalizeRunnerApiUrl('http://localhost:5173')).toBe('ws://localhost:5173/api/ws/runner')
  })

  test('keeps direct websocket runner endpoints', () => {
    expect(normalizeRunnerApiUrl('wss://polka.codes/api/ws/runner')).toBe('wss://polka.codes/api/ws/runner')
    expect(normalizeRunnerApiUrl('ws://localhost:5173/api/ws/runner')).toBe('ws://localhost:5173/api/ws/runner')
  })
})

describe('WebSocketManager protocol handshake', () => {
  test('sends connected before queued messages when the websocket opens', async () => {
    const server = new WebSocketServer({ port: 0 })
    let manager: WebSocketManager | undefined

    try {
      const port = await waitForServerPort(server)
      const queuedMessage: WsOutgoingMessage = { type: 'get_files_completed' }
      const receivedMessages = new Promise<unknown[]>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for runner websocket messages')), 2000)

        server.once('connection', (socket, request) => {
          try {
            expect(request.url).toBe('/api/ws/runner/task-1')
          } catch (error) {
            clearTimeout(timeout)
            reject(error)
            return
          }

          const messages: unknown[] = []
          socket.on('message', (data) => {
            try {
              messages.push(JSON.parse(data.toString()))

              if (messages.length === 2) {
                clearTimeout(timeout)
                resolve(messages)
              }
            } catch (error) {
              clearTimeout(timeout)
              reject(error)
            }
          })
          socket.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        })
      })

      manager = new WebSocketManager({
        taskId: 'task-1',
        sessionToken: 'session-token',
        githubToken: 'github-token',
        apiUrl: `http://127.0.0.1:${port}`,
        onMessage: async () => {},
      })

      manager.sendMessage(queuedMessage)
      manager.connect()

      await expect(receivedMessages).resolves.toEqual([{ type: 'connected' }, queuedMessage])
    } finally {
      manager?.close(true)
      await closeServer(server)
    }
  })
})
