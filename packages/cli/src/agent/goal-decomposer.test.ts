import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { Priority } from './constants'
import { GoalDecomposer } from './goal-decomposer'

describe('GoalDecomposer', () => {
  const mockContext = {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  }

  let decomposer: GoalDecomposer

  beforeEach(() => {
    decomposer = new GoalDecomposer(mockContext)
  })

  describe('decompose', () => {
    it('should decompose goal into tasks', async () => {
      mock.module('@polka-codes/core', () => ({
        runAgentWithSchema: async () => ({
          tasks: [
            {
              title: 'Add authentication middleware',
              type: 'feature',
              priority: 'high',
              complexity: 'medium',
              estimatedTime: 60,
              dependencies: [],
              files: ['src/middleware/auth.ts'],
            },
          ],
        }),
      }))

      const tasks = await decomposer.decompose('Add user authentication')

      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Add authentication middleware')
      expect(tasks[0].priority).toBe(Priority.HIGH)
      expect(tasks[0].type).toBe('feature')
    })

    it('should map string priorities to enum values', async () => {
      mock.module('@polka-codes/core', () => ({
        runAgentWithSchema: async () => ({
          tasks: [
            {
              title: 'Critical bug fix',
              type: 'fix',
              priority: 'critical',
              complexity: 'low',
              estimatedTime: 15,
              dependencies: [],
              files: [],
            },
            {
              title: 'Minor improvement',
              type: 'enhancement',
              priority: 'low',
              complexity: 'low',
              estimatedTime: 30,
              dependencies: [],
              files: [],
            },
          ],
        }),
      }))

      const tasks = await decomposer.decompose('Fix bugs')

      expect(tasks[0].priority).toBe(Priority.CRITICAL)
      expect(tasks[1].priority).toBe(Priority.LOW)
    })

    it('should generate task IDs', async () => {
      mock.module('@polka-codes/core', () => ({
        runAgentWithSchema: async () => ({
          tasks: [
            {
              title: 'Task 1',
              type: 'fix',
              priority: 'medium',
              complexity: 'low',
              estimatedTime: 30,
              dependencies: [],
              files: [],
            },
          ],
        }),
      }))

      const tasks = await decomposer.decompose('Do something')

      expect(tasks[0].id).toBeDefined()
      expect(tasks[0].id).toMatch(/^task-\d+-[a-z0-9]+$/)
    })

    it('should set createdAt timestamp', async () => {
      mock.module('@polka-codes/core', () => ({
        runAgentWithSchema: async () => ({
          tasks: [
            {
              title: 'Task 1',
              type: 'feature',
              priority: 'medium',
              complexity: 'medium',
              estimatedTime: 45,
              dependencies: [],
              files: [],
            },
          ],
        }),
      }))

      const before = Date.now()
      const tasks = await decomposer.decompose('Build feature')
      const after = Date.now()

      expect(tasks[0].createdAt).toBeGreaterThanOrEqual(before)
      expect(tasks[0].createdAt).toBeLessThanOrEqual(after)
    })

    it('should handle LLM errors gracefully', async () => {
      mock.module('@polka-codes/core', () => ({
        runAgentWithSchema: async () => {
          throw new Error('LLM API failed')
        },
      }))

      const tasks = await decomposer.decompose('Test goal')

      expect(tasks).toHaveLength(0)
    })

    it('should build workflow inputs for code tasks', async () => {
      mock.module('@polka-codes/core', () => ({
        runAgentWithSchema: async () => ({
          tasks: [
            {
              title: 'Fix bug',
              type: 'code',
              priority: 'high',
              complexity: 'medium',
              estimatedTime: 30,
              dependencies: [],
              files: ['src/test.ts'],
              description: 'Fix the null pointer error',
            },
          ],
        }),
      }))

      const tasks = await decomposer.decompose('Fix all bugs')

      expect(tasks[0].workflow).toBe('code')
      expect(tasks[0].workflowInput).toEqual({
        prompt: expect.stringContaining('Fix the null pointer error'),
        files: ['src/test.ts'],
        context: expect.any(String),
      })
    })
  })

  describe('mapPriority', () => {
    it('should map priority strings correctly', () => {
      expect(decomposer.mapPriority('critical')).toBe(Priority.CRITICAL)
      expect(decomposer.mapPriority('high')).toBe(Priority.HIGH)
      expect(decomposer.mapPriority('medium')).toBe(Priority.MEDIUM)
      expect(decomposer.mapPriority('low')).toBe(Priority.LOW)
      expect(decomposer.mapPriority('trivial')).toBe(Priority.TRIVIAL)
    })

    it('should default to MEDIUM for unknown priorities', () => {
      expect(decomposer.mapPriority('unknown' as any)).toBe(Priority.MEDIUM)
    })
  })

  describe('buildWorkflowInput', () => {
    it('should build code workflow input', () => {
      const task = {
        title: 'Fix bug',
        description: 'Fix null pointer',
        type: 'code',
        files: ['test.ts'],
      }

      const input = decomposer.buildWorkflowInput(task as any)

      expect(input.prompt).toContain('Fix null pointer')
      expect(input.files).toEqual(['test.ts'])
      expect(input.context).toBeDefined()
    })

    it('should build test workflow input', () => {
      const task = {
        title: 'Add tests',
        description: 'Test the API',
        type: 'test',
        files: ['api.ts'],
      }

      const input = decomposer.buildWorkflowInput(task as any)

      expect(input).toEqual({
        prompt: 'Test the API',
        files: ['api.ts'],
      })
    })

    it('should build workflow input for dynamic workflows', () => {
      const task = {
        title: 'Generate component',
        description: 'Create React component',
        type: 'dynamic',
        workflow: 'component-generator',
      }

      const input = decomposer.buildWorkflowInput(task as any)

      expect(input.prompt).toContain('Create React component')
      expect(input.workflow).toBe('component-generator')
    })
  })

  describe('generateTaskId', () => {
    it('should generate unique IDs', () => {
      const id1 = decomposer.generateTaskId()
      const id2 = decomposer.generateTaskId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^task-\d+-[a-z0-9]+$/)
      expect(id2).toMatch(/^task-\d+-[a-z0-9]+$/)
    })
  })
})
