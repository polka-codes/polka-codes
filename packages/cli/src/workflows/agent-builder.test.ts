import { describe, expect, it } from 'bun:test'
import type { FullToolInfo } from '@polka-codes/core'
import { z } from 'zod'
import { buildAgentToolList } from './agent-builder'

describe('agent-builder', () => {
  describe('buildAgentToolList', () => {
    it('should build default tool list', () => {
      const tools = buildAgentToolList()

      expect(tools).toBeArray()
      expect(tools.length).toBeGreaterThan(0)
      expect(tools.some((t) => t.name === 'readFile')).toBe(true)
      expect(tools.some((t) => t.name === 'writeToFile')).toBe(true)
      expect(tools.some((t) => t.name === 'replaceInFile')).toBe(true)
      expect(tools.some((t) => t.name === 'searchFiles')).toBe(true)
      expect(tools.some((t) => t.name === 'listFiles')).toBe(true)
      expect(tools.some((t) => t.name === 'fetchUrl')).toBe(true)
      expect(tools.some((t) => t.name === 'readBinaryFile')).toBe(true)
      expect(tools.some((t) => t.name === 'removeFile')).toBe(true)
      expect(tools.some((t) => t.name === 'renameFile')).toBe(true)
    })

    it('should not include interactive tool by default', () => {
      const tools = buildAgentToolList()

      expect(tools.some((t) => t.name === 'askFollowupQuestion')).toBe(false)
    })

    it('should include interactive tool when requested', () => {
      const tools = buildAgentToolList({ includeInteractive: true })

      expect(tools.some((t) => t.name === 'askFollowupQuestion')).toBe(true)
    })

    it('should include additional search tool', () => {
      const searchTool: FullToolInfo = {
        name: 'customSearch',
        description: 'Custom search',
        parameters: z.object({ query: z.string() }),
        handler: async () => ({ success: true, message: { type: 'text', value: 'Results' } }),
      }

      const tools = buildAgentToolList({
        additionalTools: { search: searchTool },
      })

      expect(tools.some((t) => t.name === 'customSearch')).toBe(true)
    })

    it('should include additional MCP tools', () => {
      const mcpTools: FullToolInfo[] = [
        {
          name: 'mcpTool1',
          description: 'MCP tool 1',
          parameters: z.object({ input: z.string() }),
          handler: async () => ({ success: true, message: { type: 'text', value: 'Result' } }),
        },
        {
          name: 'mcpTool2',
          description: 'MCP tool 2',
          parameters: z.object({ input: z.string() }),
          handler: async () => ({ success: true, message: { type: 'text', value: 'Result' } }),
        },
      ]

      const tools = buildAgentToolList({
        additionalTools: { mcpTools },
      })

      expect(tools.some((t) => t.name === 'mcpTool1')).toBe(true)
      expect(tools.some((t) => t.name === 'mcpTool2')).toBe(true)
    })

    it('should include all additional tools together', () => {
      const searchTool: FullToolInfo = {
        name: 'customSearch',
        description: 'Custom search',
        parameters: z.object({ query: z.string() }),
        handler: async () => ({ success: true, message: { type: 'text', value: 'Results' } }),
      }

      const mcpTools: FullToolInfo[] = [
        {
          name: 'mcpTool',
          description: 'MCP tool',
          parameters: z.object({ input: z.string() }),
          handler: async () => ({ success: true, message: { type: 'text', value: 'Result' } }),
        },
      ]

      const tools = buildAgentToolList({
        includeInteractive: true,
        additionalTools: { search: searchTool, mcpTools },
      })

      expect(tools.some((t) => t.name === 'askFollowupQuestion')).toBe(true)
      expect(tools.some((t) => t.name === 'customSearch')).toBe(true)
      expect(tools.some((t) => t.name === 'mcpTool')).toBe(true)
    })

    it('should preserve all default tools when adding additional tools', () => {
      const defaultTools = buildAgentToolList()
      const extraTool: FullToolInfo = {
        name: 'extra',
        description: 'Extra tool',
        parameters: z.object({}),
        handler: async () => ({ success: true, message: { type: 'text', value: 'Extra' } }),
      }

      const toolsWithExtra = buildAgentToolList({
        additionalTools: { mcpTools: [extraTool] },
      })

      // All default tools should still be present
      expect(toolsWithExtra.length).toBeGreaterThan(defaultTools.length)
      for (const tool of defaultTools) {
        expect(toolsWithExtra.some((t) => t.name === tool.name)).toBe(true)
      }
    })

    it('should return tool list with valid structure', () => {
      const tools = buildAgentToolList()

      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(tool).toHaveProperty('handler')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(typeof tool.handler).toBe('function')
      })
    })
  })
})
