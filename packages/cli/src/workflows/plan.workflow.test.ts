import { afterEach, describe, expect, mock, test } from 'bun:test'
import { UserCancelledError } from '../errors'
import type { CliToolRegistry } from './../workflow-tools'
import { planWorkflow } from './plan.workflow'
import { createTestProxy, type ExpectedToolCall } from './testing/helper'

describe('planWorkflow', () => {
  let assert: () => void

  afterEach(() => {
    assert?.()
    mock.restore()
  })

  test('should generate a plan and save it', async () => {
    const task = 'Create a new component'
    const generatedPlan = '1. Create the component file.'
    const savePath = '.plans/test.md'

    const {
      context,
      assert: proxyAssert,
      logger,
    } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: JSON.stringify({ plan: generatedPlan }),
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'save',
      },
      {
        toolName: 'input',
        args: {
          message: 'Where do you want to save the plan?',
          default: expect.any(String),
        },
        returnValue: savePath,
      },
      {
        toolName: 'writeToFile',
        args: { path: savePath, content: generatedPlan },
        returnValue: undefined,
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'interactive', interactive: true, additionalTools: {} }, context)

    expect(result.plan).toBe(generatedPlan)
    expect(logger.info).toHaveBeenCalledWith(`Plan saved to ${savePath}`)
  })

  test('should handle user feedback and regenerate plan', async () => {
    const task = 'Create a new component'
    const initialPlan = '1. Create the component file.'
    const feedback = 'Add a test file.'
    const regeneratedPlan = '1. Create the component file.\n2. Create a test file.'

    const {
      context,
      assert: proxyAssert,
      logger,
    } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: initialPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'feedback',
      },
      {
        toolName: 'input',
        args: {
          message: 'What changes do you want to make?',
        },
        returnValue: feedback,
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: regeneratedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'save',
      },
      {
        toolName: 'input',
        args: expect.anything(),
        returnValue: '.plans/test.md',
      },
      {
        toolName: 'writeToFile',
        args: expect.anything(),
        returnValue: undefined,
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'interactive', interactive: true, additionalTools: {} }, context)

    expect(result.plan).toBe(regeneratedPlan)
    expect(logger.info).toHaveBeenCalledWith('Plan saved to .plans/test.md')
  })

  test('should exit the workflow', async () => {
    const task = 'Create a new component'
    const generatedPlan = '1. Create the component file.'

    const { context, assert: proxyAssert } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: generatedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'exit',
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'interactive', interactive: true, additionalTools: {} }, context)
    expect(result.plan).toBe(generatedPlan)
  })

  test('should run in non-interactive mode', async () => {
    const task = 'Create a new component'
    const generatedPlan = '1. Create the component file.'

    const { context, assert: proxyAssert } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.any(Object),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: generatedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'noninteractive', interactive: false, additionalTools: {} }, context)

    expect(result.plan).toBe(generatedPlan)
  })

  test('should run in confirm mode and be accepted', async () => {
    const task = 'Create a new component'
    const generatedPlan = '1. Create the component file.'

    const { context, assert: proxyAssert } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.any(Object),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: generatedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'input',
        args: {
          message: 'Do you approve this plan and want to proceed with implementation? (leave blank to approve, or enter feedback)',
        },
        returnValue: '',
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'confirm', interactive: true, additionalTools: {} }, context)

    expect(result.plan).toBe(generatedPlan)
  })

  test('should run in confirm mode and be rejected', async () => {
    const task = 'Create a new component'
    const generatedPlan = '1. Create the component file.'

    const { context, assert: proxyAssert } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.any(Object),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: generatedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'input',
        args: {
          message: 'Do you approve this plan and want to proceed with implementation? (leave blank to approve, or enter feedback)',
        },
        returnValue: new UserCancelledError(),
        isError: true,
      },
    ])
    assert = proxyAssert

    await expect(planWorkflow({ task, mode: 'confirm', interactive: true, additionalTools: {} }, context)).rejects.toThrow(
      UserCancelledError,
    )
  })

  test('should handle agent asking a question', async () => {
    const task = 'Create a new component'
    const question = 'What is the name of the component?'
    const answer = 'MyComponent'
    const generatedPlan = `1. Create ${answer}`

    const { context, assert: proxyAssert } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.any(Object),
        returnValue: [
          {
            role: 'assistant',
            content: `${JSON.stringify({ question: { question } })}`,
          },
        ],
      },
      {
        toolName: 'input',
        args: { message: question, default: undefined },
        returnValue: answer,
      },
      {
        toolName: 'generateText',
        args: expect.any(Object),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: generatedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'exit',
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'interactive', interactive: true, additionalTools: {} }, context)

    expect(result.plan).toBe(generatedPlan)
  })

  test('should regenerate the plan', async () => {
    const task = 'Create a new component'
    const initialPlan = '1. Create the component file.'
    const regeneratedPlan = '1. Create a better component file.'

    const { context, assert: proxyAssert } = createTestProxy([
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: initialPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'regenerate',
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify({ plan: regeneratedPlan })}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
      {
        toolName: 'select',
        args: {
          message: 'What do you want to do?',
          choices: expect.anything(),
        },
        returnValue: 'exit',
      },
    ])
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'interactive', interactive: true, additionalTools: {} }, context)

    expect(result.plan).toBe(regeneratedPlan)
  })

  test('should return a plan with files', async () => {
    const task = 'Create a new component'
    const generatedPlan = {
      plan: '1. Create the component file.',
      files: ['src/index.ts'],
    }
    const fileContent = 'export {}'

    const expectedCalls: ExpectedToolCall<keyof CliToolRegistry>[] = [
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: `\`\`\`json
${JSON.stringify(generatedPlan)}
\`\`\``,
          },
        ],
      },
      {
        toolName: 'readFile',
        args: { path: 'src/index.ts' },
        returnValue: fileContent,
      },
      {
        toolName: 'updateMemory',
        args: expect.anything(),
        returnValue: undefined,
      },
    ]

    const { context, assert: proxyAssert } = createTestProxy(expectedCalls)
    assert = proxyAssert

    const result = await planWorkflow({ task, mode: 'noninteractive', interactive: false, additionalTools: {} }, context)

    expect(result.plan).toBe(generatedPlan.plan)
    expect(result.files).toMatchSnapshot()
  })
})
