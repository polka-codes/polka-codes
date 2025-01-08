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
provider: anthropic
apiKey: test-key
modelId: claude-3-opus
    `,
    )

    const config = loadConfig(configPath, testSubDir)
    expect(config).toEqual({
      provider: 'anthropic',
      apiKey: 'test-key',
      modelId: 'claude-3-opus',
    })
  })

  test('loads config from default paths', () => {
    const configPath = join(testSubDir, '.polkacodes.yml')
    writeFileSync(
      configPath,
      `
provider: deepseek
apiKey: test-key-2
modelId: deepseek-chat
    `,
    )

    const config = loadConfig(undefined, testSubDir)
    expect(config).toEqual({
      provider: 'deepseek',
      apiKey: 'test-key-2',
      modelId: 'deepseek-chat',
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

    expect(() => loadConfig(configPath, testSubDir)).toThrow()
  })

  test('handles commands configuration', () => {
    const configPath = join(testSubDir, 'commands-config.yml')
    writeFileSync(
      configPath,
      `
commands:
  test: echo "test"
  complex:
    command: echo "complex"
    description: A complex command
    `,
    )

    const config = loadConfig(configPath, testSubDir)
    expect(config?.commands).toEqual({
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
provider: anthropic
apiKey: global-key
modelId: claude-3-opus
commands:
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
apiKey: local-key
commands:
  test: echo "local"
rules:
  - local-rule
    `,
    )

    const config = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(config).toEqual({
      provider: 'anthropic',
      apiKey: 'local-key',
      modelId: 'claude-3-opus',
      commands: {
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
