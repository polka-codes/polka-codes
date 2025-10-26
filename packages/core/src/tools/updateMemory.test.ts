import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
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
      expect(result.error).toMatchSnapshot()
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
      expect(result.error).toMatchSnapshot()
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
      expect(result.error).toMatchSnapshot()
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

      expect(result).toMatchSnapshot()
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

      expect(result).toMatchSnapshot()
      expect(spy).toHaveBeenCalledWith('replace', 'my-topic', 'new data')
    })

    it('should handle remove operation', async () => {
      const mockProvider = new MockProvider()
      const spy = spyOn(mockProvider, 'updateMemory')

      const result = await updateMemory.handler(mockProvider, {
        operation: 'remove',
      })

      expect(result).toMatchSnapshot()
      expect(spy).toHaveBeenCalledWith('remove', undefined, undefined)
    })

    it('should return error if provider does not support memory', async () => {
      const mockProvider = new MockProvider()
      mockProvider.updateMemory = undefined as any

      const result = await updateMemory.handler(mockProvider, {
        operation: 'append',
        content: 'new data',
      })

      expect(result).toMatchSnapshot()
    })
  })
})
