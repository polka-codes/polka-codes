/**
 * Tool Test Template
 *
 * Use this template for testing tool implementations.
 * Tools are the primary way the agent interacts with the system.
 */

import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from '@polka-codes/core'
import toolName from './toolName'

describe('toolName', () => {
  describe('parameters', () => {
    it('should parse valid parameters', () => {
      const result = toolName.parameters.safeParse({
        param1: 'value',
        param2: 123,
      })

      expect(result.success).toBe(true)
    })

    it('should fail to parse missing required parameter', () => {
      const result = toolName.parameters.safeParse({
        param1: 'value',
        // param2 is missing
      })

      expect(result.success).toBe(false)
      // Verify error message is helpful
      expect(result.error.issues[0].message).toMatch(/param2/)
    })

    it('should fail to parse invalid parameter type', () => {
      const result = toolName.parameters.safeParse({
        param1: 'value',
        param2: 'not a number', // Should be number
      })

      expect(result.success).toBe(false)
    })
  })

  describe('handler', () => {
    it('should handle valid parameters', async () => {
      // Arrange
      const mockProvider = new MockProvider()
      const spy = spyOn(mockProvider, 'method')

      // Act
      const result = await toolName.handler(mockProvider, {
        param1: 'value',
        param2: 123,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message.type).toBe('text')
      expect(result.message.value).toContain('expected text')

      // Verify provider method was called correctly
      expect(spy).toHaveBeenCalledWith('expected args')
    })

    it('should return error if provider does not support operation', async () => {
      const mockProvider = new MockProvider()
      // Make provider not support this operation
      mockProvider.method = undefined as any

      const result = await toolName.handler(mockProvider, {
        param1: 'value',
        param2: 123,
      })

      expect(result.success).toBe(false)
      expect(result.message.type).toBe('error-text')
      expect(result.message.value).toContain('not supported')
    })

    it('should handle provider errors gracefully', async () => {
      const mockProvider = new MockProvider()
      spyOn(mockProvider, 'method').mockRejectedValue(new Error('Provider error'))

      const result = await toolName.handler(mockProvider, {
        param1: 'value',
        param2: 123,
      })

      expect(result.success).toBe(false)
      expect(result.message.type).toBe('error-text')
      expect(result.message.value).toContain('Provider error')
    })
  })
})
