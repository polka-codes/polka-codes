import { describe, expect, it } from 'bun:test'
import { AgentConfigSchema, mergeConfig, validateConfig } from './config'
import { DEFAULT_AGENT_CONFIG } from './constants'
import type { AgentConfig } from './types'

describe('AgentConfig', () => {
  describe('validateConfig', () => {
    it('should validate default configuration', () => {
      const config = validateConfig(DEFAULT_AGENT_CONFIG)
      expect(config).toMatchSnapshot()
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
        AgentConfigSchema.parse({
          ...DEFAULT_AGENT_CONFIG,
          requireApprovalFor: 'invalid' as any,
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
      expect(validated.requireApprovalFor).toBe('destructive')
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

      expect(merged).toMatchSnapshot()
      expect(merged.strategy).toBe('continuous-improvement')
      expect(merged.maxIterations).toBe(100)
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

      expect(merged.continuousImprovement).toMatchSnapshot()
      expect(merged.continuousImprovement.sleepTimeOnNoTasks).toBe(120000)
      expect(merged.continuousImprovement.sleepTimeBetweenTasks).toBe(base.continuousImprovement.sleepTimeBetweenTasks)
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
