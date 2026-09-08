import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentConfigSchema, loadConfig, mergeConfig, validateConfig } from './config'
import { DEFAULT_AGENT_CONFIG } from './constants'
import type { AgentConfig } from './types'

describe('AgentConfig', () => {
  describe('validateConfig', () => {
    it('should validate default configuration', () => {
      const config = validateConfig(DEFAULT_AGENT_CONFIG)
      expect(config).toBeDefined()
      expect(config.strategy).toBe('goal-directed')
      expect(config.pauseOnError).toBe(true)
    })

    it('should reject invalid strategy', () => {
      expect(() => {
        AgentConfigSchema.parse({
          ...DEFAULT_AGENT_CONFIG,
          strategy: 'invalid',
        })
      }).toThrow()
    })

    it('should reject invalid requireApprovalFor value', () => {
      expect(() => {
        validateConfig({
          ...DEFAULT_AGENT_CONFIG,
          requireApprovalFor: 'invalid',
        })
      }).toThrow()
    })

    it('should apply default values for missing fields', () => {
      const partialConfig = {
        strategy: 'goal-directed' as const,
        approval: {},
        safety: {},
      }
      const validated = AgentConfigSchema.parse(partialConfig)
      expect(validated.pauseOnError).toBe(true)
      expect(validated.maxConcurrency).toBe(1)
      expect(validated.approval.level).toBe('destructive')
      expect(validated.safety.blockDestructive).toBe(true)
    })
  })

  describe('mergeConfig', () => {
    it('should merge configurations correctly', () => {
      const base = DEFAULT_AGENT_CONFIG
      const override: Partial<AgentConfig> = {
        strategy: 'continuous-improvement',
        maxIterations: 100,
      }

      const merged = mergeConfig(base, override)

      // Check specific overrides
      expect(merged.strategy).toBe('continuous-improvement')
      expect(merged.maxIterations).toBe(100)

      // Check base fields are preserved
      expect(merged.pauseOnError).toBe(base.pauseOnError)
      expect(merged.approval).toEqual(base.approval)
      expect(merged.continuousImprovement).toEqual(base.continuousImprovement)
    })

    it('should preserve base fields when not overridden', () => {
      const base = DEFAULT_AGENT_CONFIG
      const override: Partial<AgentConfig> = {
        strategy: 'continuous-improvement',
      }

      const merged = mergeConfig(base, override)

      expect(merged.strategy).toBe('continuous-improvement')
      expect(merged.pauseOnError).toBe(base.pauseOnError)
      expect(merged.maxIterations).toBe(base.maxIterations)
    })

    it('should merge nested objects correctly', () => {
      const base = DEFAULT_AGENT_CONFIG
      const override: Partial<AgentConfig> = {
        continuousImprovement: {
          ...base.continuousImprovement,
          sleepTimeOnNoTasks: 120000,
        },
      }

      const merged = mergeConfig(base, override)

      expect(merged.continuousImprovement.sleepTimeOnNoTasks).toBe(120000)
      expect(merged.continuousImprovement.sleepTimeBetweenTasks).toBe(base.continuousImprovement.sleepTimeBetweenTasks)
      // Other nested fields preserved
      expect(merged.continuousImprovement.maxCycles).toBe(base.continuousImprovement.maxCycles)
    })

    it('should merge discovery config', () => {
      const base = DEFAULT_AGENT_CONFIG
      const override: Partial<AgentConfig> = {
        discovery: {
          enabledStrategies: ['test-coverage'],
          cacheTime: 600000,
          checkChanges: base.discovery.checkChanges,
        },
      }

      const merged = mergeConfig(base, override)

      expect(merged.discovery.enabledStrategies).toEqual(['test-coverage'])
      expect(merged.discovery.cacheTime).toBe(600000)
      expect(merged.discovery.checkChanges).toBe(base.discovery.checkChanges)
    })

    it('should merge approval config', () => {
      const base = DEFAULT_AGENT_CONFIG
      const override: Partial<AgentConfig> = {
        approval: {
          level: 'all',
          autoApproveSafeTasks: false,
          maxAutoApprovalCost: base.approval.maxAutoApprovalCost,
        },
      }

      const merged = mergeConfig(base, override)

      expect(merged.approval.level).toBe('all')
      expect(merged.approval.autoApproveSafeTasks).toBe(false)
      expect(merged.approval.maxAutoApprovalCost).toBe(base.approval.maxAutoApprovalCost)
    })

    it('should merge safety config', () => {
      const base = DEFAULT_AGENT_CONFIG
      const override: Partial<AgentConfig> = {
        safety: {
          enabledChecks: ['security-scan'],
          blockDestructive: false,
          maxFileSize: base.safety.maxFileSize,
        },
      }

      const merged = mergeConfig(base, override)

      expect(merged.safety.enabledChecks).toEqual(['security-scan'])
      expect(merged.safety.blockDestructive).toBe(false)
      expect(merged.safety.maxFileSize).toBe(base.safety.maxFileSize)
    })
  })

  describe('isValidAgentConfig', () => {
    it('should return true for valid config', () => {
      const { isValidAgentConfig } = require('./config')
      expect(isValidAgentConfig(DEFAULT_AGENT_CONFIG)).toBe(true)
    })

    it('should return false for invalid config', () => {
      const { isValidAgentConfig } = require('./config')
      expect(isValidAgentConfig({ strategy: 'invalid' })).toBe(false)
    })

    it('should return false for missing required fields', () => {
      const { isValidAgentConfig } = require('./config')
      expect(isValidAgentConfig({})).toBe(false)
    })
  })
})

describe('approval configuration precedence', () => {
  it('uses the effective approval settings from each preset', async () => {
    expect((await loadConfig({ preset: 'conservative' })).approval).toEqual({
      level: 'all',
      autoApproveSafeTasks: false,
      maxAutoApprovalCost: 0,
    })
    expect((await loadConfig({ preset: 'aggressive' })).approval).toEqual({
      level: 'none',
      autoApproveSafeTasks: true,
      maxAutoApprovalCost: 30,
    })
    await expect(loadConfig({ preset: 'unknown' })).rejects.toThrow('Unknown agent preset')
  })

  it('preserves file settings until explicitly overridden and normalizes legacy fields', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-config-'))
    const path = join(dir, 'config.json')
    try {
      await writeFile(
        path,
        JSON.stringify({ preset: 'aggressive', requireApprovalFor: 'commits', autoApproveSafeTasks: false, maxAutoApprovalCost: 2 }),
      )
      const fromFile = await loadConfig({}, path)
      expect(fromFile.approval).toEqual({ level: 'commits', autoApproveSafeTasks: false, maxAutoApprovalCost: 2 })
      expect(fromFile).not.toHaveProperty('requireApprovalFor')
      expect(fromFile).not.toHaveProperty('autoApproveSafeTasks')
      expect(fromFile).not.toHaveProperty('maxAutoApprovalCost')
      expect((await loadConfig({ approval: { level: 'all' } }, path)).approval).toEqual({
        level: 'all',
        autoApproveSafeTasks: false,
        maxAutoApprovalCost: 2,
      })
      expect((await loadConfig({ requireApprovalFor: 'none' }, path)).approval.level).toBe('none')
      await writeFile(path, JSON.stringify({ preset: 'conservative' }))
      expect((await loadConfig({}, path)).approval.level).toBe('all')
      expect((await loadConfig({ preset: 'aggressive' }, path)).approval.level).toBe('none')
      expect((await loadConfig({ requireApprovalFor: 'none', approval: { level: 'all' } })).approval.level).toBe('all')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
