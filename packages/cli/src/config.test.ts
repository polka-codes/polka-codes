import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from './config'

describe('config', () => {
  let testDir: string
  let testSubDir: string
  let testHomeDir: string

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'polkacodes-test-'))
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

  test('loads config from specified path', () => {
    const configPath = join(testSubDir, 'test-config.yml')
    writeFileSync(
      configPath,
      `
defaultProvider: anthropic
defaultModel: claude-3-opus
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config).toEqual({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-opus',
    })
  })

  test('loads config from default paths', () => {
    const configPath = join(testSubDir, '.polkacodes.yml')
    writeFileSync(
      configPath,
      `
defaultProvider: deepseek
defaultModel: deepseek-chat
    `,
    )

    const config = loadConfig(undefined, testSubDir, testHomeDir)
    expect(config).toEqual({
      defaultProvider: 'deepseek',
      defaultModel: 'deepseek-chat',
    })

    // Clean up
    writeFileSync(configPath, '')
  })

  test('validates config schema', () => {
    const configPath = join(testSubDir, 'invalid-config.yml')
    writeFileSync(
      configPath,
      `
invalidKey: value
    `,
    )

    expect(() => loadConfig(configPath, testSubDir, testHomeDir)).toThrow()
  })

  test('handles commands configuration', () => {
    const configPath = join(testSubDir, 'commands-config.yml')
    writeFileSync(
      configPath,
      `
scripts:
  test: echo "test"
  complex:
    command: echo "complex"
    description: A complex command
    `,
    )

    const config = loadConfig(configPath, testSubDir)
    expect(config?.scripts).toEqual({
      test: 'echo "test"',
      complex: {
        command: 'echo "complex"',
        description: 'A complex command',
      },
    })
  })

  test('handles rules configuration', () => {
    const configPath = join(testSubDir, 'rules-config.yml')
    writeFileSync(
      configPath,
      `
rules:
  - rule1
  - rule2
    `,
    )

    const config = loadConfig(configPath, testSubDir)
    expect(config?.rules).toEqual(['rule1', 'rule2'])
  })

  test('merges global and local config with local precedence', () => {
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, '.polkacodes.yml')

    writeFileSync(
      globalConfigPath,
      `
defaultProvider: anthropic
defaultModel: claude-3-opus
scripts:
  test: echo "global"
  complex:
    command: echo "global-complex"
    description: Global complex command
rules:
  - global-rule
    `,
    )

    writeFileSync(
      localConfigPath,
      `
providers:
  anthropic:
    apiKey: local-key
scripts:
  test: echo "local"
rules:
  - local-rule
    `,
    )

    const config = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(config).toEqual({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-opus',
      excludeFiles: undefined,
      providers: {
        anthropic: {
          apiKey: 'local-key',
        },
      },
      scripts: {
        test: 'echo "local"',
        complex: {
          command: 'echo "global-complex"',
          description: 'Global complex command',
        },
      },
      rules: ['global-rule', 'local-rule'],
    })
  })

  test('concatenates arrays', () => {
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, '.polkacodes.yml')

    writeFileSync(
      globalConfigPath,
      `
rules:
  - global-rule-1
  - global-rule-2
    `,
    )

    writeFileSync(
      localConfigPath,
      `
rules: local-rule
    `,
    )

    const config = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(config?.rules).toEqual(['global-rule-1', 'global-rule-2', 'local-rule'])
  })
})
