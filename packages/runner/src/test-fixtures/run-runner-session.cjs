const { spawn } = require('node:child_process')
const { createServer } = require('node:http')
const { join } = require('node:path')
const { WebSocketServer } = require('ws')

const [runtime, cli, directory, encodedScenario] = process.argv.slice(2)
const {
  onConnected,
  githubToken,
  tokenFailure,
  tokenFailureAt = 1,
  upgradeStatus,
  upgradeFailureAt = 1,
  policyRejectAt,
} = JSON.parse(encodedScenario)
const messages = []
const connections = []
const tokenRequests = []
const upgrades = []
const env = { ...process.env, DOTENV_CONFIG_PATH: join(directory, '.env') }
delete env.GITHUB_TOKEN
delete env.ACTIONS_ID_TOKEN_REQUEST_URL
delete env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
if (githubToken !== undefined) env.GITHUB_TOKEN = githubToken
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost')
  tokenRequests.push({ audience: url.searchParams.get('audience'), authorization: request.headers.authorization })
  if (tokenRequests.length === tokenFailureAt) {
    if (tokenFailure === 'http') {
      response.writeHead(403).end('response-secret request-secret url-secret')
      return
    }
    if (tokenFailure === 'json') {
      response.end('invalid response-secret')
      return
    }
    if (tokenFailure === 'empty') {
      response.end(JSON.stringify({ value: '', details: 'response-secret' }))
      return
    }
  }
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ value: `oidc-token-${tokenRequests.length}` }))
})
const sockets = new WebSocketServer({ noServer: true })
server.on('upgrade', (request, socket, head) => {
  const credentials = {
    sessionToken: request.headers['x-session-token'],
    oidcToken: request.headers['x-github-oidc-token'],
    githubToken: request.headers['x-github-token'],
  }
  upgrades.push(credentials)
  const status = upgrades.length === upgradeFailureAt ? upgradeStatus : undefined
  if (status || credentials.sessionToken !== 'test-token' || credentials.oidcToken !== `oidc-token-${tokenRequests.length}`) {
    socket.end(
      `HTTP/1.1 ${status || 401} Rejected\r\nConnection: close\r\n\r\nresponse-secret request-secret url-secret test-token oidc-token-${tokenRequests.length}`,
    )
    return
  }
  sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit('connection', ws, request))
})
let child
let stdout = ''
let stderr = ''
const deadline = setTimeout(() => child?.kill('SIGKILL'), 8000)
sockets.on('connection', (socket, request) => {
  connections.push({
    sessionToken: request.headers['x-session-token'],
    oidcToken: request.headers['x-github-oidc-token'],
    githubToken: request.headers['x-github-token'],
  })
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString())
    messages.push(message)
    if (message.type === 'connected') {
      if (onConnected === 'reject' || connections.length === policyRejectAt) socket.close(1008, 'Invalid runner protocol')
      else if (onConnected === 'reconnect') {
        if (connections.length === 1) socket.terminate()
        else socket.send(JSON.stringify({ type: 'done' }))
      } else socket.send(JSON.stringify(onConnected))
    } else if (
      message.type === 'pending_tools_response' ||
      (onConnected.type === 'get_files' && (message.type === 'get_files_completed' || message.type === 'error'))
    ) {
      socket.send(JSON.stringify({ type: 'done' }))
    }
  })
})
server.on('listening', () => {
  const api = `http://127.0.0.1:${server.address().port}`
  if (tokenFailure !== 'missing-url') env.ACTIONS_ID_TOKEN_REQUEST_URL = `${api}/token?credential=url-secret&audience=old`
  if (tokenFailure !== 'missing-token') env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'request-secret'
  child = spawn(runtime, [cli, '--task-id', 'lifecycle-test', '--session-token', 'test-token', '--api', api], {
    cwd: directory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (data) => {
    stdout += data
  })
  child.stderr.on('data', (data) => {
    stderr += data
  })
  child.on('close', (exitCode) => {
    clearTimeout(deadline)
    for (const socket of sockets.clients) socket.terminate()
    sockets.close()
    server.closeAllConnections()
    server.close(() =>
      process.stdout.write(JSON.stringify({ exitCode, api, tokenRequests, upgrades, connections, messages, stdout, stderr })),
    )
  })
})
server.listen(0, '127.0.0.1')
