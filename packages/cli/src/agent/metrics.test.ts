import { beforeEach, describe, expect, it } from 'bun:test'
import { MetricsCollector } from './metrics'

describe('MetricsCollector', () => {
  let collector: MetricsCollector

  beforeEach(() => {
    collector = new MetricsCollector()
  })

  describe('constructor', () => {
    it('should initialize with empty metrics', () => {
      const metrics = collector.getMetrics()

      expect(metrics.tasksCompleted).toBe(0)
      expect(metrics.tasksFailed).toBe(0)
      expect(metrics.totalTasks).toBe(0)
      expect(metrics.averageTaskTime).toBe(0)
      expect(metrics.successRate).toBe(0)
    })

    it('should initialize git metrics to zero', () => {
      const metrics = collector.getMetrics()

      expect(metrics.git.totalCommits).toBe(0)
      expect(metrics.git.totalFilesChanged).toBe(0)
      expect(metrics.git.totalInsertions).toBe(0)
      expect(metrics.git.totalDeletions).toBe(0)
      expect(metrics.git.branchesCreated).toBe(0)
    })

    it('should initialize test metrics to zero', () => {
      const metrics = collector.getMetrics()

      expect(metrics.tests.totalTestsRun).toBe(0)
      expect(metrics.tests.testsPassed).toBe(0)
      expect(metrics.tests.testsFailed).toBe(0)
      expect(metrics.tests.currentCoverage).toBe(0)
      expect(metrics.tests.testsAdded).toBe(0)
    })

    it('should initialize improvement metrics to zero', () => {
      const metrics = collector.getMetrics()

      expect(metrics.improvements.bugsFixed).toBe(0)
      expect(metrics.improvements.testsAdded).toBe(0)
      expect(metrics.improvements.refactoringsCompleted).toBe(0)
      expect(metrics.improvements.documentationAdded).toBe(0)
      expect(metrics.improvements.qualityImprovements).toBe(0)
    })

    it('should set start time and calculate execution time', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      const metrics = collector.getMetrics()

      expect(metrics.totalExecutionTime).toBeGreaterThan(0)
    })
  })

  describe('recordTaskStart', () => {
    it('should increment total tasks', () => {
      collector.recordTaskStart('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.totalTasks).toBe(1)
    })

    it('should record start time for task', () => {
      collector.recordTaskStart('task-1')

      // Cannot directly access taskStartTimes, but completion will work
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.tasksCompleted).toBe(1)
    })

    it('should handle multiple tasks', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskStart('task-2')
      collector.recordTaskStart('task-3')

      const metrics = collector.getMetrics()
      expect(metrics.totalTasks).toBe(3)
    })
  })

  describe('recordTaskComplete', () => {
    it('should increment completed tasks', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.tasksCompleted).toBe(1)
    })

    it('should update success rate', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.successRate).toBe(100)
    })

    it('should calculate partial success rate', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskStart('task-2')
      collector.recordTaskComplete('task-1')
      collector.recordTaskFailure('task-2')

      const metrics = collector.getMetrics()
      expect(metrics.successRate).toBe(50)
    })

    it('should update total execution time', async () => {
      collector.recordTaskStart('task-1')
      await new Promise((resolve) => setTimeout(resolve, 10))
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.totalExecutionTime).toBeGreaterThan(0)
    })

    it('should update average task time', async () => {
      collector.recordTaskStart('task-1')
      await new Promise((resolve) => setTimeout(resolve, 10))
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.averageTaskTime).toBeGreaterThan(0)
    })

    it('should handle completion without start', () => {
      // Should not throw, just warn
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.tasksCompleted).toBe(0)
    })
  })

  describe('recordTaskFailure', () => {
    it('should increment failed tasks', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskFailure('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.tasksFailed).toBe(1)
    })

    it('should update success rate', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskFailure('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.successRate).toBe(0)
    })

    it('should handle failure without start', () => {
      collector.recordTaskFailure('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.tasksFailed).toBe(1)
      expect(metrics.totalTasks).toBe(0)
    })
  })

  describe('recordGitOperation', () => {
    it('should record files changed', () => {
      collector.recordGitOperation({ filesChanged: 5 })

      const metrics = collector.getMetrics()
      expect(metrics.git.totalFilesChanged).toBe(5)
    })

    it('should record insertions', () => {
      collector.recordGitOperation({ insertions: 100 })

      const metrics = collector.getMetrics()
      expect(metrics.git.totalInsertions).toBe(100)
    })

    it('should record deletions', () => {
      collector.recordGitOperation({ deletions: 50 })

      const metrics = collector.getMetrics()
      expect(metrics.git.totalDeletions).toBe(50)
    })

    it('should record all git metrics at once', () => {
      collector.recordGitOperation({
        filesChanged: 3,
        insertions: 150,
        deletions: 75,
      })

      const metrics = collector.getMetrics()
      expect(metrics.git.totalFilesChanged).toBe(3)
      expect(metrics.git.totalInsertions).toBe(150)
      expect(metrics.git.totalDeletions).toBe(75)
    })

    it('should accumulate multiple operations', () => {
      collector.recordGitOperation({ filesChanged: 2 })
      collector.recordGitOperation({ filesChanged: 3 })

      const metrics = collector.getMetrics()
      expect(metrics.git.totalFilesChanged).toBe(5)
    })
  })

  describe('recordCommit', () => {
    it('should increment commit count', () => {
      collector.recordCommit()

      const metrics = collector.getMetrics()
      expect(metrics.git.totalCommits).toBe(1)
    })

    it('should accumulate multiple commits', () => {
      collector.recordCommit()
      collector.recordCommit()
      collector.recordCommit()

      const metrics = collector.getMetrics()
      expect(metrics.git.totalCommits).toBe(3)
    })
  })

  describe('recordTestResults', () => {
    it('should record passed tests', () => {
      collector.recordTestResults({ passed: 10, failed: 0 })

      const metrics = collector.getMetrics()
      expect(metrics.tests.testsPassed).toBe(10)
      expect(metrics.tests.totalTestsRun).toBe(10)
    })

    it('should record failed tests', () => {
      collector.recordTestResults({ passed: 0, failed: 2 })

      const metrics = collector.getMetrics()
      expect(metrics.tests.testsFailed).toBe(2)
      expect(metrics.tests.totalTestsRun).toBe(2)
    })

    it('should record mixed results', () => {
      collector.recordTestResults({ passed: 8, failed: 2 })

      const metrics = collector.getMetrics()
      expect(metrics.tests.testsPassed).toBe(8)
      expect(metrics.tests.testsFailed).toBe(2)
      expect(metrics.tests.totalTestsRun).toBe(10)
    })

    it('should accumulate multiple test runs', () => {
      collector.recordTestResults({ passed: 5, failed: 1 })
      collector.recordTestResults({ passed: 10, failed: 0 })

      const metrics = collector.getMetrics()
      expect(metrics.tests.testsPassed).toBe(15)
      expect(metrics.tests.testsFailed).toBe(1)
      expect(metrics.tests.totalTestsRun).toBe(16)
    })
  })

  describe('updateCoverage', () => {
    it('should update coverage percentage', () => {
      collector.updateCoverage(75.5)

      const metrics = collector.getMetrics()
      expect(metrics.tests.currentCoverage).toBe(75.5)
    })

    it('should handle 100% coverage', () => {
      collector.updateCoverage(100)

      const metrics = collector.getMetrics()
      expect(metrics.tests.currentCoverage).toBe(100)
    })

    it('should handle 0% coverage', () => {
      collector.updateCoverage(0)

      const metrics = collector.getMetrics()
      expect(metrics.tests.currentCoverage).toBe(0)
    })

    it('should overwrite previous coverage', () => {
      collector.updateCoverage(50)
      collector.updateCoverage(80)

      const metrics = collector.getMetrics()
      expect(metrics.tests.currentCoverage).toBe(80)
    })
  })

  describe('getMetrics', () => {
    it('should return copy of metrics', () => {
      const metrics1 = collector.getMetrics()
      const metrics2 = collector.getMetrics()

      expect(metrics1).toEqual(metrics2)
      expect(metrics1).not.toBe(metrics2)
    })

    it('should include current execution time', async () => {
      const metrics1 = collector.getMetrics()
      await new Promise((resolve) => setTimeout(resolve, 10))
      const metrics2 = collector.getMetrics()

      expect(metrics2.totalExecutionTime).toBeGreaterThan(metrics1.totalExecutionTime)
    })
  })

  describe('reset', () => {
    it('should reset all metrics to zero', () => {
      collector.recordTaskStart('task-1')
      collector.recordTaskComplete('task-1')
      collector.recordCommit()
      collector.recordTestResults({ passed: 5, failed: 0 })
      collector.updateCoverage(50)

      collector.reset()

      const metrics = collector.getMetrics()
      expect(metrics.tasksCompleted).toBe(0)
      expect(metrics.git.totalCommits).toBe(0)
      expect(metrics.tests.totalTestsRun).toBe(0)
      expect(metrics.tests.currentCoverage).toBe(0)
    })

    it('should clear task start times', () => {
      collector.recordTaskStart('task-1')
      collector.reset()

      // Should not throw or complete task
      collector.recordTaskComplete('task-1')

      const metrics = collector.getMetrics()
      expect(metrics.tasksCompleted).toBe(0)
    })

    it('should reset start time', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      const metrics1 = collector.getMetrics()
      collector.reset()
      const metrics2 = collector.getMetrics()

      expect(metrics2.totalExecutionTime).toBeLessThan(metrics1.totalExecutionTime)
    })
  })

  describe('complex scenarios', () => {
    it('should track complete workflow', () => {
      // Start tasks
      collector.recordTaskStart('task-1')
      collector.recordTaskStart('task-2')
      collector.recordTaskStart('task-3')

      // Complete some
      collector.recordTaskComplete('task-1')
      collector.recordTaskComplete('task-2')

      // Fail one
      collector.recordTaskFailure('task-3')

      // Record git operations
      collector.recordGitOperation({ filesChanged: 5, insertions: 100, deletions: 20 })
      collector.recordCommit()

      // Record test results
      collector.recordTestResults({ passed: 15, failed: 1 })
      collector.updateCoverage(85)

      const metrics = collector.getMetrics()

      expect(metrics.tasksCompleted).toBe(2)
      expect(metrics.tasksFailed).toBe(1)
      expect(metrics.totalTasks).toBe(3)
      expect(metrics.successRate).toBeCloseTo(66.67, 1)
      expect(metrics.git.totalFilesChanged).toBe(5)
      expect(metrics.git.totalCommits).toBe(1)
      expect(metrics.tests.totalTestsRun).toBe(16)
      expect(metrics.tests.currentCoverage).toBe(85)
    })

    it('should handle zero success rate gracefully', () => {
      const metrics = collector.getMetrics()

      expect(metrics.successRate).toBe(0)
    })

    it('should handle zero average task time gracefully', () => {
      const metrics = collector.getMetrics()

      expect(metrics.averageTaskTime).toBe(0)
    })
  })
})
