import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./test-fixtures/run-agent.ts', import.meta.url))

test('agent command initializes real model and raw workflow tools for goal decomposition', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-command-'))
  const requests: string[] = []
  const decomposition = {
    requirements: ['Inspect package'],
    highLevelPlan: 'Inspect the package and propose a focused plan.',
    tasks: [
      {
        title: 'Inspect the package',
        description: 'Inspect the package configuration and propose a plan.',
        type: 'feature',
        priority: 'low',
        complexity: 'low',
        estimatedTime: 1,
      },
    ],
    risks: [],
  }
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      requests.push(await request.text())
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: JSON.stringify(requests.length === 1 ? decomposition : { plan: 'Inspect the existing package configuration.' }),
            },
            finish_reason: null,
          },
        ],
      }
      const end = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
      return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  try {
    await mkdir(join(dir, 'src'))
    await mkdir(join(dir, '.config/polkacodes'), { recursive: true })
    await writeFile(join(dir, '.config/polkacodes/config.yml'), 'memory:\n  enabled: false\n')
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'raw-context-package', version: '1.2.3' }))
    await writeFile(join(dir, 'src/example.ts'), 'export const example = 1')
    execFileSync('git', ['init', '-q'], { cwd: dir })
    execFileSync('git', ['add', 'src/example.ts'], { cwd: dir })
    const configPath = join(dir, '.polkacodes.yml')
    await writeFile(
      configPath,
      `defaultProvider: openai-compatible\ndefaultModel: test\nretryCount: 0\nproviders:\n  openai-compatible:\n    apiKey: test\n    baseUrl: http://127.0.0.1:${server.port}/v1\n`,
    )
    const child = Bun.spawn([process.execPath, fixture, configPath], {
      cwd: dir,
      env: { ...process.env, HOME: dir },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect({ code, failed: stderr.includes('Agent failed') }).toEqual({ code: 0, failed: false })
    expect(stdout + stderr).toContain('Generated 1 task(s)')
    expect(requests).toHaveLength(2)
    expect(stdout + stderr).toContain('PLAN_WORKFLOW_OK')
    expect(requests[0]).toContain('raw-context-package')
    expect(requests[0]).toContain('src/example.ts')
    expect(stdout + stderr).not.toContain('is not a function')
    await writeFile(configPath, 'commands:\n  agent:\n    provider: unsupported\n    model: test\n')
    const failed = Bun.spawn([process.execPath, fixture, configPath], {
      cwd: dir,
      env: { ...process.env, HOME: dir },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [failedCode, failedError] = await Promise.all([failed.exited, new Response(failed.stderr).text()])
    expect(failedCode).not.toBe(0)
    expect(failedError).toContain('Unsupported AI provider: unsupported')
    expect(requests).toHaveLength(2)
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})
