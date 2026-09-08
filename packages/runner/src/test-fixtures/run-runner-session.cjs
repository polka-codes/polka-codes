const { spawn } = require('node:child_process')
const { join } = require('node:path')
const { WebSocketServer } = require('ws')

const [bun, directory, encodedMessage] = process.argv.slice(2)
const onConnected = JSON.parse(encodedMessage)
const messages = []
const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
let child
let stdout = ''
let stderr = ''
const deadline = setTimeout(() => child?.kill('SIGKILL'), 4000)
server.on('connection', (socket) => {
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString())
    messages.push(message)
    if (message.type === 'connected') {
      if (onConnected === 'reject') socket.close(1008, 'Invalid runner protocol')
      else socket.send(JSON.stringify(onConnected))
    } else if (
      message.type === 'pending_tools_response' ||
      (onConnected.type === 'get_files' && (message.type === 'get_files_completed' || message.type === 'error'))
    ) {
      socket.send(JSON.stringify({ type: 'done' }))
    }
  })
})
server.on('listening', () => {
  child = spawn(
    bun,
    [
      join(__dirname, '../cli.ts'),
      '--task-id',
      'lifecycle-test',
      '--session-token',
      'test-token',
      '--github-token',
      'test-token',
      '--api',
      `http://127.0.0.1:${server.address().port}`,
    ],
    { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  child.stdout.on('data', (data) => {
    stdout += data
  })
  child.stderr.on('data', (data) => {
    stderr += data
  })
  child.on('close', (exitCode) => {
    clearTimeout(deadline)
    for (const socket of server.clients) socket.terminate()
    server.close(() => process.stdout.write(JSON.stringify({ exitCode, messages, stdout, stderr })))
  })
})
