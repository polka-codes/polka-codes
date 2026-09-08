import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./test-fixtures/approval-modes.ts', import.meta.url))
for (const mode of ['goal', 'continuous']) {
  for (const decision of ['accept', 'reject', 'noninteractive', 'none']) {
    test(`${mode} mode enforces ${decision} approval and records the task outcome`, async () => {
      const dir = await mkdtemp(join(tmpdir(), 'approval-modes-'))
      try {
        await writeFile(join(dir, 'package.json'), '{}')
        execFileSync('git', ['init', '-q'], { cwd: dir })
        execFileSync('git', ['add', 'package.json'], { cwd: dir })
        execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], { cwd: dir })
        const child = Bun.spawn(
          [
            process.execPath,
            fixture,
            mode,
            decision === 'none' ? 'none' : 'all',
            decision === 'accept' || decision === 'reject' ? 'tty' : 'pipe',
          ],
          {
            cwd: dir,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        )
        let output = ''
        let answeredPlan = false
        let answeredTask = false
        const read = (async () => {
          for await (const chunk of child.stdout) {
            output += new TextDecoder().decode(chunk)
            if (!answeredPlan && output.includes('proceed with this plan?')) {
              expect(output).not.toContain('TASK_WORKFLOW_STARTED')
              answeredPlan = true
              child.stdin.write('yes\n')
              child.stdin.flush()
            }
            if (!answeredTask && output.includes('Approve this task?')) {
              expect(output).not.toContain('TASK_WORKFLOW_STARTED')
              answeredTask = true
              child.stdin.write(decision === 'accept' ? 'yes\n' : 'no\n')
              child.stdin.flush()
            }
          }
        })()
        const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text(), read])
        expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
        const line = output.split('\n').find((line) => line.startsWith('RESULT:'))
        if (!line) throw new Error(output || 'No child output')
        const executed = decision === 'none' || decision === 'accept'
        expect(JSON.parse(line.slice(7))).toEqual({
          taskCalls: executed ? 1 : 0,
          queued: 0,
          completed: executed ? ['completed'] : [],
          blocked: !executed && (mode === 'continuous' || decision === 'reject') ? ['blocked'] : [],
        })
        expect(answeredTask).toBe(decision === 'accept' || decision === 'reject')
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    }, 15000)
  }
}
