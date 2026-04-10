import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getGlobalConfigPath } from '@polka-codes/cli-shared'
import { validateConfig } from './config-validation'

describe('validateConfig', () => {
  let testDir: string
  let testSubDir: string
  let testHomeDir: string

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'polkacodes-config-validation-'))
  })

  beforeEach(() => {
    testSubDir = mkdtempSync(join(testDir, `sub-test-${Math.random()}`))
    testHomeDir = mkdtempSync(join(testDir, `home-test-${Math.random()}`))
    mkdirSync(join(testHomeDir, '.config', 'polkacodes'), { recursive: true })
  })

  afterEach(() => {
    rmSync(testSubDir, { recursive: true, force: true })
    rmSync(testHomeDir, { recursive: true, force: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test('returns merged typed config for valid files', async () => {
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, 'ci.polkacodes.yml')

    writeFileSync(
      globalConfigPath,
      `
defaultProvider: anthropic
providers:
  anthropic:
    apiKey: global-key
      `,
    )

    writeFileSync(
      localConfigPath,
      `
defaultModel: claude-3-7-sonnet
budget: 5
      `,
    )

    const result = await validateConfig(localConfigPath, { cwd: testSubDir, home: testHomeDir })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      throw new Error('Expected config validation to succeed')
    }

    expect(result.config.defaultProvider).toBe('anthropic')
    expect(result.config.defaultModel).toBe('claude-3-7-sonnet')
    expect(result.config.budget).toBe(5)
    expect(result.config.providers?.anthropic?.apiKey).toBe('global-key')
  })

  test('returns structured schema errors for invalid config', async () => {
    const configPath = join(testSubDir, 'invalid.polkacodes.yml')

    writeFileSync(
      configPath,
      `
invalidKey: true
      `,
    )

    const result = await validateConfig(configPath, { cwd: testSubDir, home: testHomeDir, includeGlobal: false })

    expect(result.valid).toBe(false)
    if (result.valid) {
      throw new Error('Expected config validation to fail')
    }

    expect(result.errors[0]?.source).toBe(configPath)
    expect(result.errors[0]?.code).toBe('invalid_schema')
  })

  test('reports missing explicit config paths', async () => {
    const missingConfigPath = join(testSubDir, 'missing.polkacodes.yml')

    const result = await validateConfig(missingConfigPath, { cwd: testSubDir, home: testHomeDir, includeGlobal: false })

    expect(result.valid).toBe(false)
    if (result.valid) {
      throw new Error('Expected config validation to fail')
    }

    expect(result.errors).toEqual([
      {
        source: missingConfigPath,
        message: `Config file not found: ${missingConfigPath}`,
        code: 'file_not_found',
      },
    ])
  })

  test('resolves explicit relative config paths against cwd', async () => {
    const configDir = join(testSubDir, 'configs')
    const relativeConfigPath = 'explicit-relative.polkacodes.yml'

    mkdirSync(configDir, { recursive: true })
    writeFileSync(
      join(configDir, relativeConfigPath),
      `
defaultModel: relative-test-model
budget: 12345
      `,
    )

    const result = await validateConfig(relativeConfigPath, { cwd: configDir, home: testHomeDir, includeGlobal: false })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      throw new Error('Expected config validation to succeed')
    }

    expect(result.config.defaultModel).toBe('relative-test-model')
    expect(result.config.budget).toBe(12345)
  })

  test('does not merge the same global config twice when explicitly requested', async () => {
    const globalConfigPath = getGlobalConfigPath(testHomeDir)

    writeFileSync(
      globalConfigPath,
      `
excludeFiles:
  - duplicate-check
      `,
    )

    const result = await validateConfig(globalConfigPath, { cwd: testSubDir, home: testHomeDir })

    expect(result.valid).toBe(true)
    if (!result.valid) {
      throw new Error('Expected config validation to succeed')
    }

    expect(result.config.excludeFiles).toEqual(['duplicate-check'])
  })

  test('returns empty config when no config files are present', async () => {
    const result = await validateConfig(undefined, { cwd: testSubDir, home: testHomeDir, includeGlobal: false })

    expect(result).toEqual({
      valid: true,
      config: {},
    })
  })
})
