// Generated by polka.codes

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, mergeConfigs } from '@polka-codes/cli-shared'

describe('config parameters', () => {
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

  test('loads root level defaultParameters', () => {
    const configPath = join(testSubDir, 'params-config.yml')
    writeFileSync(
      configPath,
      `
defaultProvider: anthropic
defaultParameters:
  temperature: 0.7
  top_p: 0.9
  max_tokens: 4000
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.defaultParameters).toEqual({
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4000,
    })
  })

  test('loads provider defaultParameters', () => {
    const configPath = join(testSubDir, 'provider-params-config.yml')
    writeFileSync(
      configPath,
      `
providers:
  anthropic:
    apiKey: test-key
    defaultModel: claude-3-opus
    defaultParameters:
      temperature: 0.5
      max_tokens: 3000
  openai:
    apiKey: test-key-openai
    defaultParameters:
      temperature: 0.8
      presence_penalty: 0.2
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.providers?.anthropic?.defaultParameters).toEqual({
      temperature: 0.5,
      max_tokens: 3000,
    })
    expect(config?.providers?.openai?.defaultParameters).toEqual({
      temperature: 0.8,
      presence_penalty: 0.2,
    })
  })

  test('loads agent parameters', () => {
    const configPath = join(testSubDir, 'agent-params-config.yml')
    writeFileSync(
      configPath,
      `
agents:
  default:
    provider: anthropic
    model: claude-3-opus
    parameters:
      temperature: 0.9
      max_tokens: 8000
  coder:
    model: claude-3-sonnet
    parameters:
      temperature: 0.7
      top_p: 0.95
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.agents?.default?.parameters).toEqual({
      temperature: 0.9,
      max_tokens: 8000,
    })
    expect(config?.agents?.coder?.parameters).toEqual({
      temperature: 0.7,
      top_p: 0.95,
    })
  })

  test('loads command parameters', () => {
    const configPath = join(testSubDir, 'command-params-config.yml')
    writeFileSync(
      configPath,
      `
commands:
  default:
    provider: anthropic
    model: claude-3-opus
    parameters:
      temperature: 0.7
      max_tokens: 4000
  task:
    model: claude-3-sonnet
    parameters:
      temperature: 0.8
      top_p: 0.9
    `,
    )

    const config = loadConfig(configPath, testSubDir, testHomeDir)
    expect(config?.commands?.default?.parameters).toEqual({
      temperature: 0.7,
      max_tokens: 4000,
    })
    expect(config?.commands?.task?.parameters).toEqual({
      temperature: 0.8,
      top_p: 0.9,
    })
  })

  test('merges parameters from multiple configs', () => {
    const configs = [
      {
        defaultParameters: {
          temperature: 0.7,
          top_p: 0.9,
        },
        providers: {
          anthropic: {
            defaultParameters: {
              temperature: 0.5,
              max_tokens: 2000,
            },
          },
        },
      },
      {
        defaultParameters: {
          max_tokens: 4000,
          presence_penalty: 0.1,
        },
        providers: {
          anthropic: {
            defaultParameters: {
              temperature: 0.6,
              frequency_penalty: 0.2,
            },
          },
        },
      },
    ]

    const merged = mergeConfigs(configs)
    expect(merged.defaultParameters).toEqual({
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4000,
      presence_penalty: 0.1,
    })
    expect(merged.providers?.anthropic?.defaultParameters).toEqual({
      temperature: 0.6,
      max_tokens: 2000,
      frequency_penalty: 0.2,
    })
  })

  test('merges global and local parameters with local precedence', () => {
    const globalConfigPath = join(testHomeDir, '.config', 'polkacodes', 'config.yml')
    const localConfigPath = join(testSubDir, '.polkacodes.yml')

    writeFileSync(
      globalConfigPath,
      `
defaultParameters:
  temperature: 0.7
  top_p: 0.9
providers:
  anthropic:
    defaultParameters:
      temperature: 0.5
      max_tokens: 2000
agents:
  default:
    parameters:
      temperature: 0.8
      max_tokens: 3000
    `,
    )

    writeFileSync(
      localConfigPath,
      `
defaultParameters:
  temperature: 0.6
  presence_penalty: 0.1
providers:
  anthropic:
    defaultParameters:
      temperature: 0.4
      top_k: 50
agents:
  default:
    parameters:
      temperature: 0.9
    `,
    )

    const config = loadConfig(localConfigPath, testSubDir, testHomeDir)
    expect(config?.defaultParameters).toMatchSnapshot()
    expect(config?.providers?.anthropic?.defaultParameters).toMatchSnapshot()
    expect(config?.agents?.default?.parameters).toMatchSnapshot()
  })
})
