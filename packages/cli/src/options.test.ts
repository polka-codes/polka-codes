import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AiServiceProvider } from '@polka-codes/core'
import { Command } from 'commander'

import { ApiProviderConfig, addSharedOptions, parseOptions } from './options'

describe('ApiProviderConfig', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'polkacodes-test-'))
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test('getConfigForCommand with command-specific config', () => {
    const config = new ApiProviderConfig({
      defaultProvider: AiServiceProvider.Anthropic,
      providers: {
        [AiServiceProvider.Anthropic]: {
          apiKey: 'test-key',
          defaultModel: 'claude-3-opus',
        },
      },
      commands: {
        chat: {
          provider: AiServiceProvider.DeepSeek,
          model: 'deepseek-chat',
        },
      },
    })

    expect(config.getConfigForCommand('chat')).toMatchSnapshot()
  })

  test('getConfigForCommand falls back to default provider', () => {
    const config = new ApiProviderConfig({
      defaultProvider: AiServiceProvider.Anthropic,
      providers: {
        [AiServiceProvider.Anthropic]: {
          apiKey: 'test-key',
          defaultModel: 'claude-3-opus',
        },
      },
    })

    expect(config.getConfigForCommand('unknown')).toMatchSnapshot()
  })

  test('getConfigForAgent with agent-specific config', () => {
    const config = new ApiProviderConfig({
      defaultProvider: AiServiceProvider.Anthropic,
      providers: {
        [AiServiceProvider.Anthropic]: {
          apiKey: 'test-key',
          defaultModel: 'claude-3-opus',
        },
      },
      agents: {
        coder: {
          model: 'claude-3-sonnet',
        },
      },
    })

    expect(config.getConfigForAgent('coder')).toMatchSnapshot()
  })
})

describe('parseOptions', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'polkacodes-test-'))
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test('prioritizes CLI flags over env vars and config', () => {
    const configPath = join(testDir, 'test-config.yml')
    writeFileSync(
      configPath,
      `
defaultProvider: deepseek
defaultModel: deepseek-chat
providers:
  anthropic:
    apiKey: config-key
`,
    )

    const command = new Command()
    addSharedOptions(command)
    const options = command
      .parse([
        'node',
        'test',
        '--api-provider',
        'deepseek',
        '--model',
        'deepseek-chat-32k',
        '--api-key',
        'cli-key',
        '--config',
        configPath,
        '--verbose',
      ])
      .opts()

    const result = parseOptions(options, testDir, testDir)
    expect(result.verbose).toBe(1)
    expect(result.providerConfig.getConfigForCommand('chat')).toMatchSnapshot()
  })

  test('merges environment variables with config', () => {
    process.env.POLKA_API_PROVIDER = 'deepseek'
    process.env.POLKA_MODEL = 'deepseek-chat'
    process.env.POLKA_API_KEY = 'cli-key'
    const command = new Command()
    addSharedOptions(command)
    const options = command.parse(['node', 'test']).opts()

    const result = parseOptions(options, testDir, testDir)
    expect(result.providerConfig.getConfigForCommand('chat')).toMatchSnapshot()
    // biome-ignore lint/performance/noDelete: <explanation>
    delete process.env.POLKA_API_PROVIDER
    // biome-ignore lint/performance/noDelete: <explanation>
    delete process.env.POLKA_MODEL
    // biome-ignore lint/performance/noDelete: <explanation>
    delete process.env.POLKA_API_KEY
  })

  test('throws error when apiKey provided without provider', () => {
    const command = new Command()
    addSharedOptions(command)
    const options = command.parse(['node', 'test', '--api-key', 'invalid-key']).opts()

    expect(() => parseOptions(options, testDir, testDir)).toThrow('Must specify a provider')
  })

  test('handles provider-specific environment variables', () => {
    process.env.ANTHROPIC_API_KEY = 'provider-env-key'
    const command = new Command()
    addSharedOptions(command)
    const options = command.parse(['node', 'test']).opts()

    const result = parseOptions(options, testDir, testDir)
    expect(result.providerConfig.providers.anthropic?.apiKey).toBe('provider-env-key')
  })
})
