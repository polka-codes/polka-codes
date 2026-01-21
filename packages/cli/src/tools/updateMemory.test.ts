import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from '@polka-codes/core'
import updateMemory from './updateMemory'

describe('updateMemory', () => {
  describe('parameters', () => {
    it('should parse append operation with content', () => {
      const result = updateMemory.parameters.safeParse({
        operation: 'append',
        content: 'new data',
      })
      expect(result.success).toBe(true)
    })

    it('should fail to parse append operation without content', () => {
      const result = updateMemory.parameters.safeParse({
        operation: 'append',
      })
      expect(result.success).toBe(false)
      // Verify error mentions content
      if (result.error) {
        expect(result.error.issues[0].message).toMatch(/content/i)
      }
    })

    it('should parse replace operation with content', () => {
      const result = updateMemory.parameters.safeParse({
        operation: 'replace',
        content: 'new data',
      })
      expect(result.success).toBe(true)
    })

    it('should fail to parse replace operation without content', () => {
      const result = updateMemory.parameters.safeParse({
        operation: 'replace',
      })
      expect(result.success).toBe(false)
      // Verify error mentions content
      if (result.error) {
        expect(result.error.issues[0].message).toMatch(/content/i)
      }
    })

    it('should parse remove operation without content', () => {
      const result = updateMemory.parameters.safeParse({
        operation: 'remove',
      })
      expect(result.success).toBe(true)
    })

    it('should fail to parse remove operation with content', () => {
      const result = updateMemory.parameters.safeParse({
        operation: 'remove',
        content: 'some data',
      })
      expect(result.success).toBe(false)
      // Verify error mentions content should not be provided
      if (result.error) {
        expect(result.error.issues[0].message).toBeTruthy()
      }
    })
  })

  describe('handler', () => {
    it('should handle append operation', async () => {
      const mockProvider = new MockProvider()
      const spy = spyOn(mockProvider, 'updateMemory')

      const result = await updateMemory.handler(mockProvider, {
        operation: 'append',
        content: 'new data',
      })

      expect(result.success).toBe(true)
      expect(result.message.type).toBe('text')
      expect(result.message.value).toContain('appended')
      expect(spy).toHaveBeenCalledWith('append', undefined, 'new data')
    })

    it('should handle replace operation with topic', async () => {
      const mockProvider = new MockProvider()
      const spy = spyOn(mockProvider, 'updateMemory')

      const result = await updateMemory.handler(mockProvider, {
        operation: 'replace',
        topic: 'my-topic',
        content: 'new data',
      })

      expect(result.success).toBe(true)
      expect(result.message.type).toBe('text')
      expect(result.message.value).toContain('my-topic')
      expect(result.message.value).toContain('replaced')
      expect(spy).toHaveBeenCalledWith('replace', 'my-topic', 'new data')
    })

    it('should handle remove operation', async () => {
      const mockProvider = new MockProvider()
      const spy = spyOn(mockProvider, 'updateMemory')

      const result = await updateMemory.handler(mockProvider, {
        operation: 'remove',
      })

      expect(result.success).toBe(true)
      expect(result.message.type).toBe('text')
      expect(result.message.value).toContain('removed')
      expect(spy).toHaveBeenCalledWith('remove', undefined, undefined)
    })

    it('should return error if provider does not support memory', async () => {
      const mockProvider = new MockProvider()
      mockProvider.updateMemory = undefined as any

      const result = await updateMemory.handler(mockProvider, {
        operation: 'append',
        content: 'new data',
      })

      expect(result.success).toBe(false)
      expect(result.message.type).toBe('error-text')
      expect(result.message.value).toContain('not supported')
    })
  })
})
