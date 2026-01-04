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
    it('should map feature to plan', () => {
      expect(WORKFLOW_MAPPING.feature).toBe('plan')
    })

    it('should map bugfix to fix', () => {
      expect(WORKFLOW_MAPPING.bugfix).toBe('fix')
    })

    it('should map refactor to code', () => {
      expect(WORKFLOW_MAPPING.refactor).toBe('code')
    })

    it('should map refactoring to code', () => {
      expect(WORKFLOW_MAPPING.refactoring).toBe('code')
    })

    it('should map test to code', () => {
      expect(WORKFLOW_MAPPING.test).toBe('code')
    })

    it('should map review to review', () => {
      expect(WORKFLOW_MAPPING.review).toBe('review')
    })

    it('should map commit to commit', () => {
      expect(WORKFLOW_MAPPING.commit).toBe('commit')
    })

    it('should map security to fix', () => {
      expect(WORKFLOW_MAPPING.security).toBe('fix')
    })

    it('should map optimization to code', () => {
      expect(WORKFLOW_MAPPING.optimization).toBe('code')
    })

    it('should map delete to code', () => {
      expect(WORKFLOW_MAPPING.delete).toBe('code')
    })

    it('should map force-push to code', () => {
      expect(WORKFLOW_MAPPING['force-push']).toBe('code')
    })

    it('should map reset to code', () => {
      expect(WORKFLOW_MAPPING.reset).toBe('code')
    })
  })

  describe('DEFAULT_DISCOVERY_STRATEGIES', () => {
    it('should include build-errors', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toContain('build-errors')
    })

    it('should include failing-tests', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toContain('failing-tests')
    })

    it('should include type-errors', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toContain('type-errors')
    })

    it('should include lint-issues', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toContain('lint-issues')
    })

    it('should have 4 strategies', () => {
      expect(DEFAULT_DISCOVERY_STRATEGIES).toHaveLength(4)
    })
  })

  describe('ADVANCED_DISCOVERY_STRATEGIES', () => {
    it('should include test-coverage', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toContain('test-coverage')
    })

    it('should include code-quality', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toContain('code-quality')
    })

    it('should include refactoring', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toContain('refactoring')
    })

    it('should include documentation', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toContain('documentation')
    })

    it('should include security', () => {
      expect(ADVANCED_DISCOVERY_STRATEGIES).toContain('security')
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

    it('should have 10 strategies total', () => {
      expect(ALL_DISCOVERY_STRATEGIES).toHaveLength(10)
    })
  })

  describe('STATE_TRANSITIONS', () => {
    it('should have idle to planning transition', () => {
      const transition = STATE_TRANSITIONS.find((t) => t.from.includes('idle') && t.to === 'planning')
      expect(transition).toBeDefined()
      expect(transition?.label).toBe('setGoal')
    })

    it('should have planning to executing transition', () => {
      const transition = STATE_TRANSITIONS.find((t) => t.from.includes('planning') && t.to === 'executing')
      expect(transition).toBeDefined()
      expect(transition?.label).toBe('planReady')
    })

    it('should have executing to reviewing transition', () => {
      const transition = STATE_TRANSITIONS.find((t) => t.from.includes('executing') && t.to === 'reviewing')
      expect(transition?.label).toBe('taskComplete')
    })

    it('should have executing to error-recovery transition', () => {
      const transition = STATE_TRANSITIONS.find((t) => t.from.includes('executing') && t.to === 'error-recovery')
      expect(transition?.label).toBe('taskFailed')
    })

    it('should have wildcard interrupt transition', () => {
      const transition = STATE_TRANSITIONS.find((t) => t.from.includes('*') && t.to === 'stopped')
      expect(transition).toBeDefined()
      expect(transition?.label).toBe('interrupt')
    })

    it('should have error-recovery to stopped transition', () => {
      const transition = STATE_TRANSITIONS.find((t) => t.from.includes('error-recovery') && t.to === 'stopped')
      expect(transition).toBeDefined()
      expect(transition?.label).toBe('unrecoverable')
    })
  })

  describe('DEFAULT_AGENT_CONFIG', () => {
    it('should have goal-directed strategy', () => {
      expect(DEFAULT_AGENT_CONFIG.strategy).toBe('goal-directed')
    })

    it('should not continue on completion', () => {
      expect(DEFAULT_AGENT_CONFIG.continueOnCompletion).toBe(false)
    })

    it('should have zero max iterations', () => {
      expect(DEFAULT_AGENT_CONFIG.maxIterations).toBe(0)
    })

    it('should have zero timeout', () => {
      expect(DEFAULT_AGENT_CONFIG.timeout).toBe(0)
    })

    it('should require approval for destructive operations', () => {
      expect(DEFAULT_AGENT_CONFIG.requireApprovalFor).toBe('destructive')
    })

    it('should pause on error', () => {
      expect(DEFAULT_AGENT_CONFIG.pauseOnError).toBe(true)
    })

    it('should work on main branch', () => {
      expect(DEFAULT_AGENT_CONFIG.workingBranch).toBe('main')
    })

    it('should have max concurrency of 1', () => {
      expect(DEFAULT_AGENT_CONFIG.maxConcurrency).toBe(1)
    })

    it('should have auto-save interval of 30 seconds', () => {
      expect(DEFAULT_AGENT_CONFIG.autoSaveInterval).toBe(30000)
    })

    it('should have progress enabled', () => {
      expect(DEFAULT_AGENT_CONFIG.enableProgress).toBe(true)
    })

    it('should have destructive operations defined', () => {
      expect(DEFAULT_AGENT_CONFIG.destructiveOperations).toContain('delete')
      expect(DEFAULT_AGENT_CONFIG.destructiveOperations).toContain('force-push')
      expect(DEFAULT_AGENT_CONFIG.destructiveOperations).toContain('reset')
    })

    it('should have max auto approval cost', () => {
      expect(DEFAULT_AGENT_CONFIG.maxAutoApprovalCost).toBe(5)
    })

    it('should auto approve safe tasks', () => {
      expect(DEFAULT_AGENT_CONFIG.autoApproveSafeTasks).toBe(true)
    })

    it('should have continuous improvement config', () => {
      expect(DEFAULT_AGENT_CONFIG.continuousImprovement).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.continuousImprovement.sleepTimeOnNoTasks).toBe(60000)
      expect(DEFAULT_AGENT_CONFIG.continuousImprovement.sleepTimeBetweenTasks).toBe(5000)
      expect(DEFAULT_AGENT_CONFIG.continuousImprovement.maxCycles).toBe(0)
    })

    it('should have discovery config', () => {
      expect(DEFAULT_AGENT_CONFIG.discovery).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.discovery.enabledStrategies).toEqual([...DEFAULT_DISCOVERY_STRATEGIES])
      expect(DEFAULT_AGENT_CONFIG.discovery.cacheTime).toBe(300000)
      expect(DEFAULT_AGENT_CONFIG.discovery.checkChanges).toBe(true)
    })

    it('should have approval config', () => {
      expect(DEFAULT_AGENT_CONFIG.approval).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.approval.level).toBe('destructive')
      expect(DEFAULT_AGENT_CONFIG.approval.autoApproveSafeTasks).toBe(true)
      expect(DEFAULT_AGENT_CONFIG.approval.maxAutoApprovalCost).toBe(5)
    })

    it('should have safety config', () => {
      expect(DEFAULT_AGENT_CONFIG.safety).toBeDefined()
      expect(DEFAULT_AGENT_CONFIG.safety.enabledChecks).toEqual([])
      expect(DEFAULT_AGENT_CONFIG.safety.blockDestructive).toBe(true)
      expect(DEFAULT_AGENT_CONFIG.safety.maxFileSize).toBe(10485760)
    })
  })

  describe('CONFIG_PRESETS', () => {
    it('should have conservative preset', () => {
      expect(CONFIG_PRESETS.conservative).toBeDefined()
      expect(CONFIG_PRESETS.conservative.requireApprovalFor).toBe('all')
      expect(CONFIG_PRESETS.conservative.autoApproveSafeTasks).toBe(false)
      expect(CONFIG_PRESETS.conservative.maxAutoApprovalCost).toBe(0)
    })

    it('should have balanced preset', () => {
      expect(CONFIG_PRESETS.balanced).toBeDefined()
      expect(CONFIG_PRESETS.balanced.requireApprovalFor).toBe('destructive')
      expect(CONFIG_PRESETS.balanced.autoApproveSafeTasks).toBe(true)
      expect(CONFIG_PRESETS.balanced.maxAutoApprovalCost).toBe(10)
    })

    it('should have aggressive preset', () => {
      expect(CONFIG_PRESETS.aggressive).toBeDefined()
      expect(CONFIG_PRESETS.aggressive.requireApprovalFor).toBe('none')
      expect(CONFIG_PRESETS.aggressive.autoApproveSafeTasks).toBe(true)
      expect(CONFIG_PRESETS.aggressive.maxAutoApprovalCost).toBe(30)
      expect(CONFIG_PRESETS.aggressive.pauseOnError).toBe(false)
      expect(CONFIG_PRESETS.aggressive.maxConcurrency).toBe(2)
    })

    it('should have continuous-improvement preset', () => {
      expect(CONFIG_PRESETS['continuous-improvement']).toBeDefined()
      expect(CONFIG_PRESETS['continuous-improvement'].strategy).toBe('continuous-improvement')
      expect(CONFIG_PRESETS['continuous-improvement'].continueOnCompletion).toBe(true)
      expect(CONFIG_PRESETS['continuous-improvement'].requireApprovalFor).toBe('commits')
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
  })
})
