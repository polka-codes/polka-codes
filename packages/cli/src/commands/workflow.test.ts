import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const cli = fileURLToPath(new URL('../index.ts', import.meta.url))
const requestSchema = z.object({ messages: z.array(z.unknown()), tools: z.array(z.object({ function: z.object({ name: z.string() }) })) })

for (const scenario of [
  { name: 'missing file option', content: undefined, args: [], error: 'required option' },
  { name: 'unreadable file', content: undefined, args: ['-f', 'workflow.yml'], error: 'Error reading file' },
  { name: 'malformed YAML', content: 'workflows: [', args: ['-f', 'workflow.yml'], error: 'Failed to parse workflow' },
  {
    name: 'invalid schema',
    content: 'workflows:\n  main:\n    steps: invalid',
    args: ['-f', 'workflow.yml'],
    error: 'Failed to parse workflow',
  },
  { name: 'empty registry', content: 'workflows: {}', args: ['-f', 'workflow.yml'], error: 'No workflows found' },
  {
    name: 'ambiguous selection',
    content:
      'workflows:\n  first:\n    task: First\n    steps:\n      - id: first\n        task: Inspect\n  second:\n    task: Second\n    steps:\n      - id: second\n        task: Inspect',
    args: ['-f', 'workflow.yml'],
    error: 'Multiple workflows found',
  },
  {
    name: 'unknown selection',
    content: 'workflows:\n  main:\n    task: Main\n    steps:\n      - id: inspect\n        task: Inspect',
    args: ['-f', 'workflow.yml', '-w', 'missing'],
    error: "Workflow 'missing' not found",
  },
]) {
  test(`workflow CLI exits with a failure for ${scenario.name}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'workflow-invalid-'))
    try {
      if (scenario.content !== undefined) await writeFile(join(dir, 'workflow.yml'), scenario.content)
      const child = Bun.spawn([process.execPath, cli, 'workflow', ...scenario.args], {
        cwd: dir,
        env: { ...process.env, HOME: dir },
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(stdout + stderr).toContain(scenario.error)
      expect(code).not.toBe(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}

test('workflow CLI uses supported handlers, enforces step allow-lists, and rejects unknown tools before execution', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-tools-'))
  const requests: z.infer<typeof requestSchema>[] = []
  const calls = [
    { name: 'readFile', arguments: JSON.stringify({ path: 'input.txt' }) },
    { name: 'executeCommand', arguments: JSON.stringify({ command: 'printf command-output > executed.txt' }) },
    { name: 'writeToFile', arguments: JSON.stringify({ path: 'forbidden.txt', content: 'forbidden' }) },
  ]
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      requests.push(requestSchema.parse(await request.json()))
      const delta =
        requests.length === 1
          ? { role: 'assistant', tool_calls: calls.map((fn, index) => ({ index, id: `call-${index}`, type: 'function', function: fn })) }
          : { role: 'assistant', content: 'Finished' }
      const base = { id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test' }
      const chunks = [
        { ...base, choices: [{ index: 0, delta, finish_reason: null }] },
        { ...base, choices: [{ index: 0, delta: {}, finish_reason: requests.length === 1 ? 'tool_calls' : 'stop' }] },
      ]
      return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  try {
    await mkdir(join(dir, '.config/polkacodes'), { recursive: true })
    await writeFile(join(dir, '.config/polkacodes/config.yml'), 'memory:\n  enabled: false\n')
    await writeFile(join(dir, 'input.txt'), 'unique-file-content')
    await writeFile(
      join(dir, '.polkacodes.yml'),
      `defaultProvider: openai-compatible\ndefaultModel: test\nretryCount: 0\nproviders:\n  openai-compatible:\n    apiKey: test\n    baseUrl: http://127.0.0.1:${server.port}/v1\n`,
    )
    const file = join(dir, 'workflow.yml')
    await writeFile(
      file,
      'workflows:\n  main:\n    task: Read and execute\n    steps:\n      - id: inspect\n        task: Read input.txt and run a command\n        tools: [readFile, executeCommand]\n',
    )
    const run = async () => {
      const child = Bun.spawn([process.execPath, cli, 'workflow', '-f', file, '--yes'], {
        cwd: dir,
        env: { ...process.env, HOME: dir },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, output: stdout + stderr }
    }
    const result = await run()
    expect(result.code).toBe(0)
    expect(requests[0].tools.map((tool) => tool.function.name).sort()).toEqual(['executeCommand', 'readFile'])
    expect(await readFile(join(dir, 'executed.txt'), 'utf8')).toBe('command-output')
    expect(JSON.stringify(requests.at(-1)?.messages)).toContain('unique-file-content')
    expect(await Bun.file(join(dir, 'forbidden.txt')).exists()).toBe(false)
    expect(JSON.stringify(requests.at(-1)?.messages)).toContain('writeToFile')
    const count = requests.length
    await writeFile(
      file,
      'workflows:\n  main:\n    task: Invalid tool\n    steps:\n      - id: branch\n        if:\n          condition: "false"\n          thenBranch:\n            - id: invalid\n              task: Cannot run\n              tools: [writeFile]\n',
    )
    const invalid = await run()
    expect(invalid.code).not.toBe(0)
    expect(invalid.output).toContain("Unknown tool 'writeFile' at 'main/branch/then/invalid'")
    expect(invalid.output).toContain('writeToFile')
    expect(requests).toHaveLength(count)
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})
