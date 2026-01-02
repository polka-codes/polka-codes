import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { WorkflowAdapter } from './workflow-adapter'

describe('WorkflowAdapter', () => {
  const mockContext = {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    cwd: '/test',
  }

  beforeEach(() => {
    // Clear any mocks
  })

  describe('invokeWorkflow', () => {
    it('should invoke code workflow', async () => {
      const input = {
        prompt: 'Fix the bug',
        files: ['test.ts'],
        context: 'Error message',
      }

      // Mock the workflow
      mock.module('../workflows/code.workflow', () => ({
        codeWorkflow: async () => ({
          success: true,
          summaries: ['Fixed bug in test.ts'],
          details: {},
        }),
      }))

      const result = await WorkflowAdapter.invokeWorkflow('code', input, mockContext)

      expect(result.success).toBe(true)
      expect(result.output).toContain('Fixed bug')
    })

    it('should handle workflow errors gracefully', async () => {
      const input = {
        prompt: 'Invalid task',
      }

      mock.module('../workflows/code.workflow', () => ({
        codeWorkflow: async () => {
          throw new Error('Workflow failed')
        },
      }))

      const result = await WorkflowAdapter.invokeWorkflow('code', input, mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain('Workflow failed')
    })

    it('should return error for unknown workflow type', async () => {
      const result = await WorkflowAdapter.invokeWorkflow('unknown' as any, {}, mockContext)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Unknown workflow')
    })
  })

  describe('adaptCodeWorkflow', () => {
    it('should adapt successful code workflow result', async () => {
      const mockResult = {
        success: true,
        summaries: ['Fixed bug', 'Added tests'],
        details: { filesModified: ['test.ts'] },
      }

      mock.module('../workflows/code.workflow', () => ({
        codeWorkflow: async () => mockResult,
      }))

      const result = await WorkflowAdapter.adaptCodeWorkflow({}, mockContext)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResult)
      expect(result.output).toBe('Fixed bug\nAdded tests')
    })

    it('should adapt failed code workflow result', async () => {
      const mockResult = {
        success: false,
        error: 'Type errors found',
      }

      mock.module('../workflows/code.workflow', () => ({
        codeWorkflow: async () => mockResult,
      }))

      const result = await WorkflowAdapter.adaptCodeWorkflow({}, mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('Type errors found')
    })
  })
})
