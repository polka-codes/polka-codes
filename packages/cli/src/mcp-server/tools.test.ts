import { describe, expect, test } from 'bun:test'
import { createPolkaCodesServerTools } from './tools'

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const tools = createPolkaCodesServerTools(logger)

function getTool(name: string) {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) {
    throw new Error(`Missing MCP tool: ${name}`)
  }
  return tool
}

describe('MCP tool contracts', () => {
  test('keeps argument documentation out of tool descriptions', () => {
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.description).not.toContain('Parameters:')
    }
  })

  test('validates commit staging inputs', () => {
    const commit = getTool('commit')

    expect(commit.inputSchema.safeParse({ message: ' ', stageFiles: 'all' }).success).toBe(false)
    expect(commit.inputSchema.safeParse({ stageFiles: [] }).success).toBe(false)
    expect(commit.inputSchema.safeParse({ message: 'Explain why', stageFiles: ['src/file.ts'] }).success).toBe(true)
  })

  test('rejects conflicting review targets', () => {
    const review = getTool('review')

    expect(review.inputSchema.safeParse({ pr: 12, range: 'main...HEAD' }).success).toBe(false)
    expect(review.inputSchema.safeParse({ pr: 0 }).success).toBe(false)
    expect(review.inputSchema.safeParse({ files: [] }).success).toBe(false)
    expect(review.inputSchema.safeParse({ range: 'main...HEAD', files: ['src/file.ts'] }).success).toBe(true)
  })

  test('applies memory defaults and validates update modes', () => {
    expect(getTool('memory_read').inputSchema.parse({ project: '/project' })).toEqual({
      project: '/project',
      topic: ':default:',
    })
    expect(getTool('memory_query').inputSchema.parse({ project: '/project' })).toEqual({
      project: '/project',
      operation: 'select',
    })

    const update = getTool('memory_update').inputSchema
    expect(update.safeParse({ project: '/project', operation: 'append' }).success).toBe(false)
    expect(update.safeParse({ project: '/project', operation: 'remove', content: 'unexpected' }).success).toBe(false)
    expect(
      update.safeParse({ project: '/project', operation: 'append', topic: ':one:', topics: [':two:'], content: 'value' }).success,
    ).toBe(false)
    expect(update.safeParse({ project: '/project', operation: 'append', topic: ':one:', content: ['value'] }).success).toBe(false)
    expect(update.safeParse({ project: '/project', operation: 'replace', topics: [':one:', ':two:'], content: ['one'] }).success).toBe(
      false,
    )
    expect(update.safeParse({ project: '/project', operation: 'replace', topics: [':one:', ':two:'], content: 'shared' }).success).toBe(
      true,
    )
  })
})
