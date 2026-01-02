import { describe, expect, it } from 'bun:test'
import { AgentConfigSchema, mergeConfig, validateConfig } from './config'
import { DEFAULT_AGENT_CONFIG } from './constants'
import type { AgentConfig } from './types'

describe('AgentConfig', () => {
  it('should validate default configuration', () => {
    const config = validateConfig(DEFAULT_AGENT_CONFIG)
    expect(config.strategy).toBe('goal-directed')
    expect(config.requireApprovalFor).toBe('destructive')
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

  it('should merge configurations correctly', () => {
    const base = DEFAULT_AGENT_CONFIG
    const override: Partial<AgentConfig> = {
      strategy: 'continuous-improvement',
      maxIterations: 100,
    }

    const merged = mergeConfig(base, override)

    expect(merged.strategy).toBe('continuous-improvement')
    expect(merged.maxIterations).toBe(100)
    // Other fields should remain
    expect(merged.pauseOnError).toBe(base.pauseOnError)
  })

  it('should merge nested objects', () => {
    const base = DEFAULT_AGENT_CONFIG
    const override: Partial<AgentConfig> = {
      resourceLimits: {
        maxMemory: 4096,
      },
    }

    const merged = mergeConfig(base, override)

    expect(merged.resourceLimits.maxMemory).toBe(4096)
    // Other resource limits should remain
    expect(merged.resourceLimits.maxCpuPercent).toBe(base.resourceLimits.maxCpuPercent)
  })
})

describe('Priority Enum', () => {
  it('should have correct priority values', () => {
    const { Priority } = require('./types')

    expect(Priority.CRITICAL).toBe(1000)
    expect(Priority.HIGH).toBe(800)
    expect(Priority.MEDIUM).toBe(600)
    expect(Priority.LOW).toBe(400)
    expect(Priority.TRIVIAL).toBe(200)
  })
})

describe('State Transitions', () => {
  it('should have valid state transitions', () => {
    const { STATE_TRANSITIONS } = require('./constants')

    expect(STATE_TRANSITIONS).toBeInstanceOf(Array)
    expect(STATE_TRANSITIONS.length).toBeGreaterThan(0)

    STATE_TRANSITIONS.forEach((transition) => {
      expect(transition.from).toBeDefined()
      expect(transition.to).toBeDefined()
      expect(transition.label).toBeDefined()
    })
  })
})

describe('Workflow Mapping', () => {
  it('should map task types to workflows', () => {
    const { WORKFLOW_MAPPING } = require('./constants')

    expect(WORKFLOW_MAPPING.feature).toBe('plan')
    expect(WORKFLOW_MAPPING.bugfix).toBe('fix')
    expect(WORKFLOW_MAPPING.refactor).toBe('code')
    expect(WORKFLOW_MAPPING.test).toBe('code')
    expect(WORKFLOW_MAPPING.docs).toBe('code')
    expect(WORKFLOW_MAPPING.review).toBe('review')
    expect(WORKFLOW_MAPPING.commit).toBe('commit')
    expect(WORKFLOW_MAPPING.analysis).toBe('plan')
  })
})
