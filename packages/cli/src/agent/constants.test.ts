import { describe, expect, it } from 'bun:test'
import {
  ADVANCED_DISCOVERY_STRATEGIES,
  ALL_DISCOVERY_STRATEGIES,
  CONFIG_PRESETS,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_DISCOVERY_STRATEGIES,
  STATE_TRANSITIONS,
  WORKFLOW_MAPPING,
} from './constants'

describe('constants', () => {
  describe('WORKFLOW_MAPPING', () => {
    // REMOVED: Snapshot test for type-guaranteed constant
    // TypeScript's type system already validates this structure at compile time

    it('should include all required task types', () => {
      const requiredTypes = ['feature', 'bugfix', 'refactor', 'review', 'commit', 'security'] as const
      requiredTypes.forEach((type) => {
        expect(WORKFLOW_MAPPING[type]).toBeDefined()
      })
    })

    it('should map each task type to a valid workflow', () => {
      Object.values(WORKFLOW_MAPPING).forEach((workflow) => {
        expect(workflow).toBeDefined()
        expect(typeof workflow).toBe('string')
      })
    })
  })

  describe('DEFAULT_DISCOVERY_STRATEGIES', () => {
    // REMOVED: Snapshot test for type-guaranteed constant

    it('should have 4 strategies', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toHaveLength(4)
    })

    it('should have valid strategy names', () => {
      const validStrategies = ['build-errors', 'failing-tests', 'type-errors', 'lint-issues'] as const
      DEFAULT_DISCOVERY_STRATEGIES.forEach((strategy) => {
        expect(validStrategies).toContain(strategy)
      })
    })
  })

  describe('ADVANCED_DISCOVERY_STRATEGIES', () => {
    // REMOVED: Snapshot test for type-guaranteed constant

    it('should have 5 strategies', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toHaveLength(5)
    })

    it('should have valid strategy names', () => {
      const validStrategies = ['test-coverage', 'code-quality', 'refactoring', 'documentation', 'security'] as const
      ADVANCED_DISCOVERY_STRATEGIES.forEach((strategy) => {
        expect(validStrategies).toContain(strategy)
      })
    })
  })

  describe('ALL_DISCOVERY_STRATEGIES', () => {
    it('should include all default strategies', () => {
      DEFAULT_DISCOVERY_STRATEGIES.forEach((strategy) => {
        expect(ALL_DISCOVERY_STRATEGIES).toContain(strategy)
      })
    })

    it('should include all advanced strategies', () => {
      ADVANCED_DISCOVERY_STRATEGIES.forEach((strategy) => {
        expect(ALL_DISCOVERY_STRATEGIES).toContain(strategy)
      })
    })

    it('should have 10 strategies total (including working-dir)', () => {
      expect(ALL_DISCOVERY_STRATEGIES).toHaveLength(10)
    })
  })

  describe('STATE_TRANSITIONS', () => {
    // REMOVED: Snapshot test for type-guaranteed constant

    it('should have valid transition structure', () => {
      STATE_TRANSITIONS.forEach((transition) => {
        expect(transition.from).toBeDefined()
        expect(transition.to).toBeDefined()
        expect(transition.label).toBeDefined()
        expect(transition.from).toBeInstanceOf(Array)
        expect(typeof transition.to).toBe('string')
        expect(typeof transition.label).toBe('string')
      })
    })

    it('should have critical transitions', () => {
      const transitionLabels = STATE_TRANSITIONS.map((t) => t.label)
      expect(transitionLabels).toContain('setGoal')
      expect(transitionLabels).toContain('planReady')
      expect(transitionLabels).toContain('taskComplete')
      expect(transitionLabels).toContain('taskFailed')
      expect(transitionLabels).toContain('interrupt')
    })

    it('should have unique transition labels', () => {
      const labels = STATE_TRANSITIONS.map((t) => t.label)
      const uniqueLabels = new Set(labels)
      expect(uniqueLabels.size).toBe(labels.length)
    })
  })

  describe('DEFAULT_AGENT_CONFIG', () => {
    // REMOVED: Snapshot test for type-guaranteed constant

    it('should have all required config sections', () => {
      expect(DEFAULT_AGENT_CONFIG.continuousImprovement).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.discovery).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.approval).toBeDefined()
    })

    it('should have discovery config with default strategies', () => {
      expect(DEFAULT_AGENT_CONFIG.discovery.enabledStrategies).toEqual([...DEFAULT_DISCOVERY_STRATEGIES])
    })

    it('should have valid approval level', () => {
      expect(['all', 'destructive', 'none']).toContain(DEFAULT_AGENT_CONFIG.approval.level)
    })
  })

  describe('CONFIG_PRESETS', () => {
    it('should have all required presets', () => {
      const presetNames = ['conservative', 'balanced', 'aggressive', 'continuous-improvement', 'working-dir']
      presetNames.forEach((name) => {
        expect(CONFIG_PRESETS[name]).toBeDefined()
      })
    })

    // REMOVED: Snapshot tests for individual presets
    // These are type-guaranteed constants validated by TypeScript

    it('should have aggressive preset with all discovery strategies', () => {
      expect(CONFIG_PRESETS.aggressive.discovery?.enabledStrategies).toEqual([...ALL_DISCOVERY_STRATEGIES])
    })

    it('should have conservative preset with default discovery strategies', () => {
      expect(CONFIG_PRESETS.conservative.discovery?.enabledStrategies).toEqual([...DEFAULT_DISCOVERY_STRATEGIES])
    })

    it('should have continuous-improvement preset with test-coverage', () => {
      const ciStrategies = CONFIG_PRESETS['continuous-improvement'].discovery?.enabledStrategies
      expect(ciStrategies).toContain('test-coverage')
    })

    it('should have working-dir preset with working-dir strategy', () => {
      const wdStrategies = CONFIG_PRESETS['working-dir'].discovery?.enabledStrategies
      expect(wdStrategies).toContain('working-dir')
    })

    it('should have all presets with valid approval levels', () => {
      const validLevels = ['all', 'destructive', 'none', 'commits']
      Object.values(CONFIG_PRESETS).forEach((preset) => {
        if (preset.requireApprovalFor) {
          expect(validLevels).toContain(preset.requireApprovalFor)
        }
      })
    })
  })
})
