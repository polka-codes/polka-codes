// Generated by polka.codes

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseOptions } from './options'

describe('agent option', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'polkacodes-test-'))
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test('defaults to architect when no agent specified', () => {
    const result = parseOptions({})
    expect(result.agent).toBe('architect')
  })

  test('uses agent from CLI option', () => {
    const result = parseOptions({
      agent: 'coder',
    })
    expect(result.agent).toBe('coder')
  })

  test('uses agent from config', () => {
    const configPath = join(testDir, 'test-config.yml')
    writeFileSync(
      configPath,
      `
agent: analyzer
`,
    )

    const result = parseOptions(
      {
        config: [configPath],
      },
      testDir,
    )
    expect(result.agent).toBe('analyzer')
  })

  test('CLI option overrides config', () => {
    const configPath = join(testDir, 'test-config.yml')
    writeFileSync(
      configPath,
      `
agent: analyzer
`,
    )

    const result = parseOptions(
      {
        config: [configPath],
        agent: 'coder',
      },
      testDir,
    )
    expect(result.agent).toBe('coder')
  })
})
