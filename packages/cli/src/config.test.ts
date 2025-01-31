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

    const config = loadConfig(configPath, testSubDir, testHomeDir)
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

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.rules).toEqual(['rule1', 'rule2'])
  })

  test('handles agent and command defaults', () => {
    const configPath = join(testSubDir, 'defaults-config.yml')
    writeFileSync(
      configPath,
      `
agents:
  default:
    provider: anthropic
    model: claude-3-opus
  coder:
    model: claude-3-sonnet
commands:
  default:
    provider: deepseek
    model: deepseek-chat
  task:
    model: deepseek-coder
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.agents).toEqual({
      default: {
        provider: 'anthropic',
        model: 'claude-3-opus',
      },
      coder: {
        model: 'claude-3-sonnet',
      },
    })
    expect(config?.commands).toEqual({
      default: {
        provider: 'deepseek',
        model: 'deepseek-chat',
      },
      task: {
        model: 'deepseek-coder',
      },
    })
  })

  test('merges global and local config with local precedence', () => {
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, '.polkacodes.yml')

    writeFileSync(
      globalConfigPath,
      `
defaultProvider: anthropic
defaultModel: claude-3-opus
agents:
  default:
    provider: anthropic
    model: claude-3-opus
  coder:
    model: claude-3-sonnet
commands:
  default:
    provider: deepseek
    model: deepseek-chat
hooks:
  agents:
    coder:
      beforeCompletion: "echo 'global coder hook'"
    architect:
      beforeCompletion: "echo 'global architect hook'"
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
agents:
  coder:
    model: claude-3-haiku
  architect:
    provider: deepseek
commands:
  default:
    model: deepseek-coder-instruct
hooks:
  agents:
    coder:
      beforeCompletion: "echo 'local coder hook'"
    architect:
      beforeCompletion: "echo 'local architect hook'"
scripts:
  test: echo "local"
rules:
  - local-rule
    `,
    )

    const config = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(config).toMatchSnapshot()
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

  test('handles hooks configuration', () => {
    const configPath = join(testSubDir, 'hooks-config.yml')
    writeFileSync(
      configPath,
      `
hooks:
  agents:
    coder:
      beforeCompletion: "echo 'before completion'"
    architect:
      beforeCompletion: "echo 'architect hook'"
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.hooks).toEqual({
      agents: {
        coder: {
          beforeCompletion: "echo 'before completion'",
        },
        architect: {
          beforeCompletion: "echo 'architect hook'",
        },
      },
    })
  })

  test('merges hooks from global and local configs', () => {
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, '.polkacodes.yml')

    writeFileSync(
      globalConfigPath,
      `
hooks:
  agents:
    coder:
      beforeCompletion: "echo 'global coder hook'"
    architect:
      beforeCompletion: "echo 'global architect hook'"
    `,
    )

    writeFileSync(
      localConfigPath,
      `
hooks:
  agents:
    coder:
      beforeCompletion: "echo 'local coder hook'"
    `,
    )

    const config = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(config?.hooks).toEqual({
      agents: {
        coder: {
          beforeCompletion: "echo 'local coder hook'",
        },
        architect: {
          beforeCompletion: "echo 'global architect hook'",
        },
      },
    })
  })

  test('parses project .polkacodes.yml successfully', () => {
    loadConfig()
  })

  test('parses example.polkacodes.yml successfully', () => {
    loadConfig('example.polkacodes.yml')
  })

  test('handles both string and array rules formats', () => {
    // Test string format
    const stringConfigPath = join(testSubDir, 'string-rules.yml')
    writeFileSync(
      stringConfigPath,
      `
rules: |
  Rule 1
  Rule 2
  Rule 3
      `,
    )
    const stringConfig = loadConfig(stringConfigPath, testSubDir, testHomeDir)
    expect(typeof stringConfig?.rules).toBe('string')
    expect(stringConfig?.rules).toContain('Rule 1')

    // Test array format
    const arrayConfigPath = join(testSubDir, 'array-rules.yml')
    writeFileSync(
      arrayConfigPath,
      `
rules:
  - "Rule 1"
  - "Rule 2"
  - "Rule 3"
      `,
    )
    const arrayConfig = loadConfig(arrayConfigPath, testSubDir, testHomeDir)
    expect(Array.isArray(arrayConfig?.rules)).toBe(true)
    expect(arrayConfig?.rules).toHaveLength(3)

    // Test merging behavior
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, 'merged-rules.yml')

    writeFileSync(
      globalConfigPath,
      `
rules:
  - "Global Rule 1"
  - "Global Rule 2"
      `,
    )

    writeFileSync(
      localConfigPath,
      `
rules: "Local Rule"
      `,
    )

    const mergedConfig = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(Array.isArray(mergedConfig?.rules)).toBe(true)
    expect(mergedConfig?.rules).toEqual(['Global Rule 1', 'Global Rule 2', 'Local Rule'])
  })
})
