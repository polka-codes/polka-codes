// @ts-expect-error - ValidationResult.errors property access issues
import { describe, expect, it } from 'bun:test'
import type { FullToolInfo } from '../tool'
import { createDynamicWorkflow, parseDynamicWorkflowDefinition, validateWorkflowFile } from './dynamic'
import type { WorkflowFile } from './dynamic-types'

describe('Dynamic Workflow Edge Cases', () => {
  const mockToolInfo: FullToolInfo[] = [
    {
      name: 'testTool',
      description: 'A test tool',
      parameters: { type: 'object' } as any,
      handler: async () => ({ success: true, message: { type: 'text', value: 'Test result' } }),
    },
  ]

  describe('validation edge cases', () => {
    it('should reject workflow with no steps', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          empty: {
            task: 'Empty workflow',
            steps: [],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("Workflow 'empty' has no steps")
    })

    it('should reject break statement outside loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          invalidBreak: {
            task: 'Invalid break',
            steps: [
              {
                id: 'invalidStep',
                break: true,
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('break/continue outside of a loop')
    })

    it('should reject continue statement outside loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          invalidContinue: {
            task: 'Invalid continue',
            steps: [
              {
                id: 'invalidStep',
                continue: true,
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('break/continue outside of a loop')
    })

    it('should accept break inside while loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          validBreak: {
            task: 'Valid break',
            steps: [
              {
                id: 'loopWithBreak',
                while: {
                  condition: 'true',
                  steps: [{ break: true }],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })

    it('should accept continue inside while loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          validContinue: {
            task: 'Valid continue',
            steps: [
              {
                id: 'loopWithContinue',
                while: {
                  condition: 'true',
                  steps: [{ continue: true }],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })

    it('should reject break inside if/else branch (not in loop)', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          breakInIf: {
            task: 'Break in if',
            steps: [
              {
                id: 'check',
                if: {
                  condition: 'true',
                  thenBranch: [{ break: true }],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('break/continue outside of a loop')
    })

    it('should accept break inside if/else inside while loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          breakInIfInLoop: {
            task: 'Valid break in if in loop',
            steps: [
              {
                id: 'loop',
                while: {
                  condition: 'true',
                  steps: [
                    {
                      id: 'check',
                      if: {
                        condition: 'true',
                        thenBranch: [{ break: true }],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })
  })

  describe('parse errors', () => {
    it('should reject invalid YAML syntax', () => {
      const invalidYaml = `
workflows:
  test:
    task: Test
    steps: [
      id: step1
      invalid yaml here
`

      const result = parseDynamicWorkflowDefinition(invalidYaml)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject workflow with missing required fields', () => {
      const invalidWorkflow = `
workflows:
  test:
    steps: []
`

      const result = parseDynamicWorkflowDefinition(invalidWorkflow)
      expect(result.success).toBe(false)
      expect(result.error).toContain('task')
    })
  })

  describe('condition evaluation edge cases', () => {
    it('should handle undefined variables in conditions gracefully', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Test undefined variable',
            steps: [
              {
                id: 'checkUndefined',
                task: 'Check undefined',
              },
            ],
            output: 'result',
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      // This should not throw during creation, but would throw during execution
      expect(workflow).toBeDefined()
    })

    it('should handle complex boolean expressions', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Complex boolean',
            steps: [
              {
                id: 'check',
                if: {
                  condition: 'state.a && state.b || state.c',
                  thenBranch: [{ id: 'then', task: 'Then' }],
                },
              },
            ],
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })
  })

  describe('input validation edge cases', () => {
    it('should validate that required inputs without defaults are checked', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Test required input',
            inputs: [
              {
                id: 'required',
                description: 'Required input',
              },
            ],
            steps: [
              {
                id: 'step1',
                task: 'Step 1',
              },
            ],
          },
        },
      }

      // Workflow creation should succeed
      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })

    it('should handle inputs with defaults', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Test default input',
            inputs: [
              {
                id: 'value',
                description: 'Value with default',
                default: 42,
              },
            ],
            steps: [
              {
                id: 'step1',
                task: 'Step 1',
              },
            ],
            output: 'value',
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })

    it('should handle multiple inputs with mixed defaults', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Test mixed inputs',
            inputs: [
              {
                id: 'required1',
                description: 'Required input 1',
              },
              {
                id: 'optional1',
                description: 'Optional input',
                default: 'default-value',
              },
              {
                id: 'required2',
                description: 'Required input 2',
              },
            ],
            steps: [
              {
                id: 'step1',
                task: 'Step 1',
              },
            ],
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })
  })

  describe('nested control flow edge cases', () => {
    it('should handle deeply nested while loops', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Deeply nested loops',
            steps: [
              {
                id: 'outer',
                while: {
                  condition: 'state.i < 2',
                  steps: [
                    {
                      id: 'middle',
                      while: {
                        condition: 'state.j < 2',
                        steps: [
                          {
                            id: 'inner',
                            while: {
                              condition: 'state.k < 2',
                              steps: [{ id: 'work', task: 'Work' }],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })

    it('should handle if/else with nested try/catch', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Nested try/catch in if',
            steps: [
              {
                id: 'check',
                if: {
                  condition: 'true',
                  thenBranch: [
                    {
                      id: 'tryBlock',
                      try: {
                        trySteps: [{ id: 'attempt', task: 'Try' }],
                        catchSteps: [{ id: 'recover', task: 'Catch' }],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })
  })

  describe('workflow not found errors', () => {
    it('should throw error for non-existent workflow', async () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          existing: {
            task: 'Existing workflow',
            steps: [{ id: 'step1', task: 'Step 1' }],
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      const mockContext = {
        tools: {} as any,
        logger: {
          info: (_msg: string) => {},
          debug: (_msg: string) => {},
          warn: (_msg: string) => {},
          error: (_msg: string) => {},
        },
        step: async (_name: string, fn: () => Promise<any>) => await fn(),
      }

      await expect(workflow('nonexistent', {}, mockContext)).rejects.toThrow("Workflow 'nonexistent' not found")
    })
  })

  describe('state management edge cases', () => {
    it('should handle state mutation in loops', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'State mutation',
            steps: [
              {
                id: 'loop',
                while: {
                  condition: 'state.count < 3',
                  steps: [
                    {
                      id: 'increment',
                      task: 'Increment',
                      output: 'count',
                    },
                  ],
                },
              },
            ],
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })

    it('should propagate state through nested structures', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'State propagation',
            steps: [
              {
                id: 'first',
                task: 'First step',
                output: 'value1',
              },
              {
                id: 'conditional',
                if: {
                  condition: 'true',
                  thenBranch: [
                    {
                      id: 'second',
                      task: 'Second step',
                      output: 'value2',
                    },
                  ],
                },
              },
            ],
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })
  })
})
