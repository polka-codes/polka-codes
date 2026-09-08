import { describe, expect, it } from 'bun:test'
import type { FullToolInfo } from '../tool'
import type { AgentToolRegistry } from './agent.workflow'
import { createDynamicWorkflow, validateWorkflowFile } from './dynamic'
import type { WorkflowControlFlowStep, WorkflowFile } from './dynamic-types'
import { createContext } from './workflow'

describe('Dynamic Workflow Try/Catch Blocks', () => {
  it.each([undefined, 'saved-result'])('stores a loop result after break with output=%s', async (output) => {
    const context = createContext<AgentToolRegistry>({
      generateText: async ({ messages }) => ({
        requestMessages: messages,
        responseMessages: [{ role: 'assistant', content: '42' }],
      }),
      taskEvent: async () => {},
      invokeTool: async () => {
        throw new Error('No tool calls expected')
      },
    })
    const run = createDynamicWorkflow<AgentToolRegistry>(
      {
        workflows: {
          test: {
            task: 'Return the result of a loop that breaks inside try',
            output: output ?? 'loop',
            steps: [
              {
                id: 'loop',
                output,
                while: {
                  condition: 'true',
                  steps: [
                    { id: 'value', task: 'Produce a result' },
                    { id: 'guard', try: { trySteps: [{ break: true }], catchSteps: [] } },
                  ],
                },
              },
            ],
          },
        },
      },
      { toolInfo: [] },
    )

    expect(await run('test', {}, context)).toBe(42)
  })

  for (const arm of ['try', 'catch'] as const) {
    for (const control of ['break', 'continue'] as const) {
      it(`propagates ${control} through an if inside the ${arm} arm`, async () => {
        const requests: string[] = []
        const context = createContext<AgentToolRegistry>({
          generateText: async ({ messages }) => {
            requests.push(JSON.stringify(messages))
            return {
              requestMessages: [...messages],
              responseMessages: [{ role: 'assistant', content: String(requests.length - 1) }],
            }
          },
          taskEvent: async () => {},
          invokeTool: async () => {
            throw new Error('No tool calls expected')
          },
        })
        const controlledSteps: WorkflowControlFlowStep[] = [
          {
            id: 'branch',
            if: { condition: 'true', thenBranch: [control === 'break' ? { break: true } : { continue: true }] },
          },
          { id: 'skipped-in-arm', task: 'must not execute inside the arm' },
        ]
        const definition: WorkflowFile = {
          workflows: {
            test: {
              task: 'Propagate loop control',
              steps: [
                { id: 'init', task: 'initialize', output: 'iteration' },
                {
                  id: 'loop',
                  while: {
                    condition: 'state.iteration < 2',
                    steps: [
                      { id: 'advance', task: 'advance', output: 'iteration' },
                      {
                        id: 'guard',
                        try: {
                          trySteps:
                            arm === 'try' ? controlledSteps : [{ id: 'fail', if: { condition: 'unsupportedExpression', thenBranch: [] } }],
                          catchSteps: arm === 'catch' ? controlledSteps : [],
                        },
                      },
                      { id: 'skipped-in-loop', task: 'must not execute after the guard' },
                    ],
                  },
                },
                { id: 'done', task: 'after the loop' },
              ],
            },
          },
        }
        const run = createDynamicWorkflow<AgentToolRegistry>(definition, { toolInfo: [] })
        await run('test', {}, context)

        expect(requests).toHaveLength(control === 'break' ? 3 : 4)
        expect(requests.some((request) => request.includes('must not execute'))).toBe(false)
        expect(requests.at(-1)).toContain('after the loop')
      })
    }
  }

  const mockToolInfo: FullToolInfo[] = [
    {
      name: 'errorTool',
      description: 'A tool that throws errors',
      parameters: { type: 'object' } as any,
      handler: async () => {
        throw new Error('Tool execution failed')
      },
    },
    {
      name: 'successTool',
      description: 'A tool that succeeds',
      parameters: { type: 'object' } as any,
      handler: async () => ({
        success: true,
        message: { type: 'text', value: 'Success' },
      }),
    },
  ]

  describe('validation', () => {
    it('should accept try/catch with empty catch steps', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Try with empty catch',
            steps: [
              {
                id: 'tryBlock',
                try: {
                  trySteps: [{ id: 'attempt', task: 'Try something' }],
                  catchSteps: [],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })

    it('should accept try/catch with empty try steps', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Try with empty try',
            steps: [
              {
                id: 'tryBlock',
                try: {
                  trySteps: [],
                  catchSteps: [{ id: 'recover', task: 'Recover' }],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })

    it('should accept nested try/catch in try block', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Nested try in try',
            steps: [
              {
                id: 'outerTry',
                try: {
                  trySteps: [
                    {
                      id: 'innerTry',
                      try: {
                        trySteps: [{ id: 'danger', task: 'Danger' }],
                        catchSteps: [{ id: 'innerRecover', task: 'Inner recover' }],
                      },
                    },
                  ],
                  catchSteps: [{ id: 'outerRecover', task: 'Outer recover' }],
                },
              },
            ],
          },
        },
      }

      const result = validateWorkflowFile(workflowDef)
      expect(result.success).toBe(true)
    })

    it('should accept nested try/catch in catch block', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Nested try in catch',
            steps: [
              {
                id: 'outerTry',
                try: {
                  trySteps: [{ id: 'danger', task: 'Danger' }],
                  catchSteps: [
                    {
                      id: 'innerTry',
                      try: {
                        trySteps: [{ id: 'moreDanger', task: 'More danger' }],
                        catchSteps: [{ id: 'innerRecover', task: 'Inner recover' }],
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

    it('should accept break inside try block within loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Break in try within loop',
            steps: [
              {
                id: 'loop',
                while: {
                  condition: 'true',
                  steps: [
                    {
                      id: 'tryBlock',
                      try: {
                        trySteps: [{ break: true }],
                        catchSteps: [{ id: 'recover', task: 'Recover' }],
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

    it('should accept break inside catch block within loop', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Break in catch within loop',
            steps: [
              {
                id: 'loop',
                while: {
                  condition: 'true',
                  steps: [
                    {
                      id: 'tryBlock',
                      try: {
                        trySteps: [{ id: 'attempt', task: 'Attempt' }],
                        catchSteps: [{ break: true }],
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

  describe('structure', () => {
    it('should create workflow with try/catch', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Test try/catch',
            steps: [
              {
                id: 'riskyOperation',
                try: {
                  trySteps: [
                    {
                      id: 'attemptTask',
                      task: 'Attempt a risky operation',
                      tools: ['internet'],
                    },
                  ],
                  catchSteps: [
                    {
                      id: 'handleError',
                      task: 'Handle the error gracefully',
                      output: 'fallbackResult',
                    },
                  ],
                },
                output: 'result',
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

    it('should handle multiple sequential try/catch blocks', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Multiple try/catch',
            steps: [
              {
                id: 'firstTry',
                try: {
                  trySteps: [{ id: 'firstAttempt', task: 'First attempt' }],
                  catchSteps: [{ id: 'firstRecover', task: 'First recovery' }],
                },
              },
              {
                id: 'secondTry',
                try: {
                  trySteps: [{ id: 'secondAttempt', task: 'Second attempt' }],
                  catchSteps: [{ id: 'secondRecover', task: 'Second recovery' }],
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

    it('should handle try/catch inside if/else', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Try/catch in if',
            steps: [
              {
                id: 'check',
                if: {
                  condition: 'true',
                  thenBranch: [
                    {
                      id: 'tryBlock',
                      try: {
                        trySteps: [{ id: 'attempt', task: 'Attempt' }],
                        catchSteps: [{ id: 'recover', task: 'Recover' }],
                      },
                    },
                  ],
                  elseBranch: [
                    {
                      id: 'elseTry',
                      try: {
                        trySteps: [{ id: 'elseAttempt', task: 'Else attempt' }],
                        catchSteps: [{ id: 'elseRecover', task: 'Else recover' }],
                      },
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

    it('should handle try/catch with output from catch block', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Try/catch with output',
            steps: [
              {
                id: 'tryBlock',
                try: {
                  trySteps: [
                    {
                      id: 'attempt',
                      task: 'Attempt',
                      output: 'tryResult',
                    },
                  ],
                  catchSteps: [
                    {
                      id: 'recover',
                      task: 'Recover',
                      output: 'catchResult',
                    },
                  ],
                },
                output: 'finalResult',
              },
            ],
            output: 'finalResult',
          },
        },
      }

      const workflow = createDynamicWorkflow(workflowDef, {
        toolInfo: mockToolInfo,
      })

      expect(workflow).toBeDefined()
    })

    it('should handle deeply nested try/catch structures', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Deeply nested try/catch',
            steps: [
              {
                id: 'level1',
                try: {
                  trySteps: [
                    {
                      id: 'level2',
                      while: {
                        condition: 'state.i < 2',
                        steps: [
                          {
                            id: 'level3',
                            if: {
                              condition: 'true',
                              thenBranch: [
                                {
                                  id: 'level4',
                                  try: {
                                    trySteps: [{ id: 'core', task: 'Core operation' }],
                                    catchSteps: [{ id: 'coreRecover', task: 'Core recovery' }],
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                  catchSteps: [{ id: 'level1Recover', task: 'Level 1 recovery' }],
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

  describe('output handling', () => {
    it('should allow try/catch without output field', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Try/catch without output',
            steps: [
              {
                id: 'tryBlock',
                try: {
                  trySteps: [{ id: 'attempt', task: 'Attempt' }],
                  catchSteps: [{ id: 'recover', task: 'Recover' }],
                },
              },
              {
                id: 'nextStep',
                task: 'Next step',
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

    it('should use step id as default output key', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Default output key',
            steps: [
              {
                id: 'myTryBlock',
                try: {
                  trySteps: [
                    {
                      id: 'attempt',
                      task: 'Attempt',
                      output: 'value',
                    },
                  ],
                  catchSteps: [{ id: 'recover', task: 'Recover' }],
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

  describe('error scenarios', () => {
    it('should handle empty try and catch steps', () => {
      const workflowDef: WorkflowFile = {
        workflows: {
          test: {
            task: 'Empty try/catch',
            steps: [
              {
                id: 'emptyBlock',
                try: {
                  trySteps: [],
                  catchSteps: [],
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
})
