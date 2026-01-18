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
    it('should have correct mapping structure', () => {
      expect(WORKFLOW_MAPPING).toMatchSnapshot()
    })

    it('should include all required task types', () => {
      const requiredTypes = ['feature', 'bugfix', 'refactor', 'review', 'commit', 'security'] as const
      requiredTypes.forEach((type) => {
        expect(WORKFLOW_MAPPING[type]).toBeDefined()
      })
    })
  })

  describe('DEFAULT_DISCOVERY_STRATEGIES', () => {
    it('should have correct strategies', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toMatchSnapshot()
    })

    it('should have 4 strategies', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toHaveLength(4)
    })
  })

  describe('ADVANCED_DISCOVERY_STRATEGIES', () => {
    it('should have correct strategies', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toMatchSnapshot()
    })

    it('should have 5 strategies', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toHaveLength(5)
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
    it('should have correct transition structure', () => {
      expect(STATE_TRANSITIONS).toMatchSnapshot()
    })

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
  })

  describe('DEFAULT_AGENT_CONFIG', () => {
    it('should have correct default configuration', () => {
      expect(DEFAULT_AGENT_CONFIG).toMatchSnapshot()
    })

    it('should have all required config sections', () => {
      expect(DEFAULT_AGENT_CONFIG.continuousImprovement).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.discovery).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.approval).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.safety).toBeDefined()
    })

    it('should have discovery config with default strategies', () => {
      expect(DEFAULT_AGENT_CONFIG.discovery.enabledStrategies).toEqual([...DEFAULT_DISCOVERY_STRATEGIES])
    })
  })

  describe('CONFIG_PRESETS', () => {
    it('should have all required presets', () => {
      const presetNames = ['conservative', 'balanced', 'aggressive', 'continuous-improvement', 'working-dir']
      presetNames.forEach((name) => {
        expect(CONFIG_PRESETS[name]).toBeDefined()
      })
    })

    it('should have correct conservative preset', () => {
      expect(CONFIG_PRESETS.conservative).toMatchSnapshot()
    })

    it('should have correct balanced preset', () => {
      expect(CONFIG_PRESETS.balanced).toMatchSnapshot()
    })

    it('should have correct aggressive preset', () => {
      expect(CONFIG_PRESETS.aggressive).toMatchSnapshot()
    })

    it('should have correct continuous-improvement preset', () => {
      expect(CONFIG_PRESETS['continuous-improvement']).toMatchSnapshot()
    })

    it('should have correct working-dir preset', () => {
      expect(CONFIG_PRESETS['working-dir']).toMatchSnapshot()
    })

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
  })
})
