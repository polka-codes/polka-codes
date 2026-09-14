import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'
import { parse } from 'yaml'
import { z } from 'zod'
import type { WsOutgoingMessage } from './types'
import { normalizeRunnerApiUrl, WebSocketManager } from './WebSocketManager'

let savedCredentials: (string | undefined)[]
let tokenServer: ReturnType<typeof Bun.serve>
let audiences: (string | null)[]
let tokenResponse: () => Response | Promise<Response>
const credentialNames = ['ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'] as const

beforeEach(() => {
  savedCredentials = credentialNames.map((name) => process.env[name])
  audiences = []
  tokenResponse = () => Response.json({ value: 'oidc-token' })
  tokenServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      audiences.push(new URL(request.url).searchParams.get('audience'))
      return tokenResponse()
    },
  })
  process.env.ACTIONS_ID_TOKEN_REQUEST_URL = tokenServer.url.toString()
  process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'request-token'
})

afterEach(async () => {
  await tokenServer.stop(true)
  credentialNames.forEach((name, index) => {
    if (savedCredentials[index] === undefined) delete process.env[name]
    else process.env[name] = savedCredentials[index]
  })
})

const workflowSchema = z.object({
  'run-name': z.string(),
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

    expect(workflow['run-name']).toBe('Remote Runner - $' + '{{ github.event.client_payload.taskId }}')
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

  test('removes suffixes that would corrupt the appended task path', () => {
    expect(normalizeRunnerApiUrl('wss://polka.codes/api/ws/runner/?ignored=true#fragment')).toBe('wss://polka.codes/api/ws/runner')
    expect(normalizeRunnerApiUrl('ws://localhost:5173/')).toBe('ws://localhost:5173')
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
            expect(request.headers['x-session-token']).toBe('session-token')
            expect(request.headers['x-github-oidc-token']).toBe('oidc-token')
            expect(request.headers['x-github-token']).toBeUndefined()
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
        apiUrl: `http://127.0.0.1:${port}`,
        onMessage: async () => {},
      })

      manager.sendMessage(queuedMessage)
      await manager.connect()

      await expect(receivedMessages).resolves.toEqual([{ type: 'connected' }, queuedMessage])
      expect(audiences).toEqual([`http://127.0.0.1:${port}/api/ws/runner/task-1`])
    } finally {
      manager?.close(true)
      await closeServer(server)
    }
  })

  test('encodes task IDs as one path segment', async () => {
    const server = new WebSocketServer({ port: 0 })
    let manager: WebSocketManager | undefined

    try {
      const port = await waitForServerPort(server)
      const connected = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for runner websocket connection')), 2000)

        server.once('connection', (_socket, request) => {
          clearTimeout(timeout)
          try {
            expect(request.url).toBe('/api/ws/runner/task%2Fwith%20spaces')
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      })

      manager = new WebSocketManager({
        taskId: 'task/with spaces',
        sessionToken: 'session-token',
        apiUrl: `ws://127.0.0.1:${port}/api/ws/runner/`,
        onMessage: async () => {},
      })
      await manager.connect()

      await connected
      expect(audiences).toEqual([`http://127.0.0.1:${port}/api/ws/runner/task%2Fwith%20spaces`])
    } finally {
      manager?.close(true)
      await closeServer(server)
    }
  })
})

describe('OIDC connection lifecycle', () => {
  test('reacquires a token and sends connected before messages queued during acquisition', async () => {
    const acquiring = Promise.withResolvers<void>()
    const token = Promise.withResolvers<Response>()
    tokenResponse = () => {
      if (audiences.length === 2) {
        acquiring.resolve()
        return token.promise
      }
      return Response.json({ value: 'first-token' })
    }
    const server = new WebSocketServer({ port: 0 })
    const received: unknown[] = []
    const flushed = Promise.withResolvers<void>()
    server.on('connection', (socket, request) => {
      expect(request.headers['x-github-oidc-token']).toBe(audiences.length === 1 ? 'first-token' : 'second-token')
      socket.on('message', (data) => {
        received.push(JSON.parse(data.toString()))
        if (received.length === 1) socket.terminate()
        if (received.length === 4) flushed.resolve()
      })
    })
    let manager: WebSocketManager | undefined
    try {
      const port = await waitForServerPort(server)
      manager = new WebSocketManager({
        taskId: 'queue',
        sessionToken: 'session',
        apiUrl: `http://127.0.0.1:${port}`,
        onMessage: async () => {},
      })
      await manager.connect()
      await acquiring.promise
      const queued: WsOutgoingMessage[] = [{ type: 'file_deleted', path: 'queued.txt' }, { type: 'get_files_completed' }]
      for (const message of queued) manager.sendMessage(message)
      token.resolve(Response.json({ value: 'second-token' }))
      await flushed.promise
      expect(audiences).toHaveLength(2)
      expect(received).toEqual([{ type: 'connected' }, { type: 'connected' }, ...queued])
    } finally {
      manager?.close()
      token.resolve(Response.json({ value: 'second-token' }))
      await closeServer(server)
    }
  })

  test.each([
    ['https://polka.codes/path?query=1#fragment', 'https://polka.codes'],
    ['wss://staging.polka.codes/direct/?query=1#fragment', 'https://staging.polka.codes'],
    ['http://localhost:5173/path?query=1#fragment', 'http://localhost:5173'],
    ['ws://localhost:5173/direct/?query=1#fragment', 'http://localhost:5173'],
  ])('derives the canonical audience for %s', async (apiUrl, origin) => {
    tokenResponse = () => new Response(null, { status: 403 })
    const manager = new WebSocketManager({ taskId: 'task/with spaces%', sessionToken: 'session', apiUrl, onMessage: async () => {} })
    try {
      await expect(manager.connect()).rejects.toThrow('HTTP 403')
      expect(audiences).toEqual([`${origin}/api/ws/runner/task%2Fwith%20spaces%25`])
    } finally {
      manager.close()
    }
  })

  test('close aborts acquisition and even a late successful response cannot open a socket', async () => {
    const response = Promise.withResolvers<Response>()
    let signal: AbortSignal | null | undefined
    // Deliberately ignore abort to exercise the completion race, not just fetch cancellation.
    const request = spyOn(globalThis, 'fetch').mockImplementation(
      Object.assign(
        (_url: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => {
          signal = options?.signal
          return response.promise
        },
        { preconnect: fetch.preconnect },
      ),
    )
    const server = new WebSocketServer({ port: 0 })
    let connections = 0
    server.on('connection', () => connections++)
    const port = await waitForServerPort(server)
    const manager = new WebSocketManager({
      taskId: 'cancelled',
      sessionToken: 'session',
      apiUrl: `http://127.0.0.1:${port}`,
      onMessage: async () => {},
    })
    const previousExitCode = process.exitCode
    try {
      const connecting = manager.connect()
      manager.close()
      expect(signal?.aborted).toBe(true)
      response.resolve(Response.json({ value: 'late-token' }))
      await connecting
      await new Promise((resolve) => setImmediate(resolve))
      expect(connections).toBe(0)
      expect(process.exitCode).toBe(previousExitCode)
    } finally {
      manager.close()
      request.mockRestore()
      await closeServer(server)
    }
  })
})
