import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CliWorkflowContext } from '../workflows/agent-builder'
import { Priority } from './constants'
import { GoalDecomposer } from './goal-decomposer'

describe('GoalDecomposer', () => {
  const mockTools = {
    executeCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    readFile: async () => null,
  }

  const mockContext: CliWorkflowContext = {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    tools: mockTools as any,
    workingDir: '/test',
    stateDir: '/test/.polka',
    sessionId: 123,
    env: {},
  }

  let decomposer: GoalDecomposer

  beforeEach(() => {
    decomposer = new GoalDecomposer(mockContext)
  })

  describe('decompose', () => {
    it('should decompose goal into GoalDecompositionResult', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: ['User authentication', 'Session management'],
          highLevelPlan: 'Implement authentication with JWT tokens',
          tasks: [
            {
              title: 'Add authentication middleware',
              type: 'feature',
              priority: 'high',
              complexity: 'medium',
              estimatedTime: 60,
              dependencies: [],
              files: ['src/middleware/auth.ts'],
              description: 'Create auth middleware',
            },
          ],
          risks: ['Security concerns'],
        }),
      }))

      const result = await decomposer.decompose('Add user authentication')

      expect(result).toBeDefined()
      expect(result.goal).toBe('Add user authentication')
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].title).toBe('Add authentication middleware')
      expect(result.tasks[0].priority).toBe(Priority.HIGH)
      expect(result.tasks[0].type).toBe('feature')
      expect(result.requirements).toHaveLength(2)
      expect(result.highLevelPlan).toBe('Implement authentication with JWT tokens')
      expect(result.risks).toHaveLength(1)
    })

    it('should map string priorities to enum values', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: [],
          highLevelPlan: 'Fix bugs',
          tasks: [
            {
              title: 'Critical bug fix',
              type: 'bugfix',
              priority: 'critical',
              complexity: 'low',
              estimatedTime: 15,
              dependencies: [],
              files: [],
              description: 'Fix critical bug',
            },
            {
              title: 'Minor improvement',
              type: 'feature',
              priority: 'low',
              complexity: 'low',
              estimatedTime: 30,
              dependencies: [],
              files: [],
              description: 'Minor improvement',
            },
          ],
          risks: [],
        }),
      }))

      const result = await decomposer.decompose('Fix bugs')

      expect(result.tasks[0].priority).toBe(Priority.CRITICAL)
      expect(result.tasks[1].priority).toBe(Priority.LOW)
    })

    it('should generate task IDs', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: [],
          highLevelPlan: 'Do something',
          tasks: [
            {
              title: 'Task 1',
              type: 'bugfix',
              priority: 'medium',
              complexity: 'low',
              estimatedTime: 30,
              dependencies: [],
              files: [],
              description: 'Task 1',
            },
          ],
          risks: [],
        }),
      }))

      const result = await decomposer.decompose('Do something')

      expect(result.tasks[0].id).toBeDefined()
      expect(result.tasks[0].id).toMatch(/^task-\d+-[a-z0-9]+$/)
    })

    it('should set createdAt timestamp', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: [],
          highLevelPlan: 'Build feature',
          tasks: [
            {
              title: 'Task 1',
              type: 'feature',
              priority: 'medium',
              complexity: 'medium',
              estimatedTime: 45,
              dependencies: [],
              files: [],
              description: 'Task 1',
            },
          ],
          risks: [],
        }),
      }))

      const before = Date.now()
      const result = await decomposer.decompose('Build feature')
      const after = Date.now()

      expect(result.tasks[0].createdAt).toBeGreaterThanOrEqual(before)
      expect(result.tasks[0].createdAt).toBeLessThanOrEqual(after)
    })

    it('should include retryCount in tasks', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: [],
          highLevelPlan: 'Test',
          tasks: [
            {
              title: 'Test task',
              type: 'feature',
              priority: 'medium',
              complexity: 'low',
              estimatedTime: 30,
              dependencies: [],
              files: [],
              description: 'Test task',
            },
          ],
          risks: [],
        }),
      }))

      const result = await decomposer.decompose('Test goal')

      expect(result.tasks[0].retryCount).toBe(0)
    })

    it('should estimate complexity', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: [],
          highLevelPlan: 'Simple task',
          tasks: [
            {
              title: 'Simple task',
              type: 'feature',
              priority: 'medium',
              complexity: 'low',
              estimatedTime: 30,
              dependencies: [],
              files: [],
              description: 'Simple task',
            },
          ],
          risks: [],
        }),
      }))

      const result = await decomposer.decompose('Simple task')

      expect(result.estimatedComplexity).toBeDefined()
      expect(['low', 'medium', 'high']).toContain(result.estimatedComplexity)
    })

    it('should extract dependencies', async () => {
      mock.module('../workflows/agent-builder', () => ({
        runAgentWithSchema: async () => ({
          requirements: [],
          highLevelPlan: 'Multi-step task',
          tasks: [
            {
              title: 'Task 1',
              type: 'feature',
              priority: 'high',
              complexity: 'medium',
              estimatedTime: 30,
              dependencies: [],
              files: [],
              description: 'First task',
            },
            {
              title: 'Task 2',
              type: 'feature',
              priority: 'medium',
              complexity: 'low',
              estimatedTime: 15,
              dependencies: ['Task 1'],
              files: [],
              description: 'Second task',
            },
          ],
          risks: [],
        }),
      }))

      const result = await decomposer.decompose('Multi-step task')

      expect(result.dependencies).toHaveLength(1)
      expect(result.dependencies[0].type).toBe('hard')
    })
  })
})
