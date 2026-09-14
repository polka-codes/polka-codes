import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { inspect } from 'node:util'
import { requestGitHubOidcToken } from './github-oidc'

const credentials = ['ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'] as const
let saved: (string | undefined)[]
let server: ReturnType<typeof Bun.serve>
let requests: { url: string; method: string; authorization: string | null }[]
let respond: (request: Request) => Response | Promise<Response>

beforeEach(() => {
  saved = credentials.map((name) => process.env[name])
  requests = []
  respond = () => Response.json({ value: 'opaque-oidc-token' })
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      requests.push({ url: request.url, method: request.method, authorization: request.headers.get('authorization') })
      return respond(request)
    },
  })
  process.env.ACTIONS_ID_TOKEN_REQUEST_URL = `${server.url}token?credential=url-secret&audience=old`
  process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'request-secret'
})

afterEach(async () => {
  await server.stop(true)
  credentials.forEach((name, index) => {
    if (saved[index] === undefined) delete process.env[name]
    else process.env[name] = saved[index]
  })
})

const audience = 'https://staging.polka.codes/api/ws/runner/task%2Fwith%20spaces'
const requestToken = () => requestGitHubOidcToken(audience, new AbortController().signal)

describe('GitHub OIDC acquisition', () => {
  test('requests an opaque token with bearer credentials and preserves endpoint parameters', async () => {
    await expect(requestToken()).resolves.toBe('opaque-oidc-token')
    expect(requests).toHaveLength(1)
    const request = requests[0]
    expect(request.method).toBe('GET')
    expect(request.authorization).toBe('Bearer request-secret')
    const url = new URL(request.url)
    expect(url.searchParams.get('credential')).toBe('url-secret')
    expect(url.searchParams.getAll('audience')).toEqual([audience])
  })

  test.each([...credentials])('explains permissions when %s is missing', async (name) => {
    delete process.env[name]
    await expect(requestToken()).rejects.toThrow('GitHub Actions job with id-token: write')
    expect(requests).toHaveLength(0)
  })

  test('does not disclose an invalid credential-bearing request URL', async () => {
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'invalid url-secret'
    const token = requestToken()
    await expect(token).rejects.toThrow(/^Invalid GitHub OIDC request URL\.$/)
    expect(inspect(await token.catch((error: unknown) => error))).not.toContain('url-secret')
    expect(requests).toHaveLength(0)
  })

  test('does not attach credential-bearing fetch errors to the rejection', async () => {
    const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? '')
    url.username = 'request-secret'
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = url.toString()
    const token = requestToken()
    await expect(token).rejects.toThrow(/^Failed to request a GitHub OIDC token\.$/)
    expect(inspect(await token.catch((error: unknown) => error))).not.toContain('request-secret')
    expect(requests).toHaveLength(0)
  })

  test('reports the HTTP status without disclosing the response or retrying', async () => {
    respond = () => new Response('request-secret url-secret response-secret', { status: 403 })
    await expect(requestToken()).rejects.toThrow(/^GitHub OIDC token request failed \(HTTP 403\)\.$/)
    expect(requests).toHaveLength(1)
  })

  test('reports invalid JSON without disclosing it', async () => {
    respond = () => new Response('"response-secret" trailing')
    const token = requestToken()
    await expect(token).rejects.toThrow(/^Invalid JSON in the GitHub OIDC token response\.$/)
    expect(inspect(await token.catch((error: unknown) => error))).not.toContain('response-secret')
  })

  test.each([{}, { value: '' }, { value: 42 }, null])('rejects malformed token response %j', async (body) => {
    respond = () => Response.json(body)
    await expect(requestToken()).rejects.toThrow('expected a nonempty value string')
  })

  test('reports network failure without retrying or exposing the endpoint', async () => {
    await server.stop(true)
    await expect(requestToken()).rejects.toThrow(/^Failed to request a GitHub OIDC token\.$/)
    expect(requests).toHaveLength(0)
  })

  test('preserves intentional cancellation of a pending request', async () => {
    const started = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    respond = () => {
      started.resolve()
      return response.promise
    }
    const controller = new AbortController()
    const token = requestGitHubOidcToken(audience, controller.signal)
    try {
      await started.promise
      controller.abort()
      await expect(token).rejects.toThrow('abort')
      expect(requests).toHaveLength(1)
    } finally {
      response.resolve(Response.json({ value: 'late-token' }))
    }
  })
})
