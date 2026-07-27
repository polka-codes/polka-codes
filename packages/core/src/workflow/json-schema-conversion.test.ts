import { describe, expect, it } from 'bun:test'
import { convertJsonSchemaToZod, type JsonSchema } from './dynamic'

describe('JSON Schema to Zod Conversion', () => {
  describe('primitive types', () => {
    it('should convert string schema', () => {
      const schema: JsonSchema = { type: 'string' }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse('hello')).toBe('hello')
      expect(() => zodSchema.parse(123)).toThrow()
    })

    it('should convert number schema', () => {
      const schema: JsonSchema = { type: 'number' }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(42)).toBe(42)
      expect(zodSchema.parse(3.14)).toBe(3.14)
      expect(() => zodSchema.parse('42')).toThrow()
    })

    it('should convert integer schema', () => {
      const schema: JsonSchema = { type: 'integer' }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(42)).toBe(42)
      expect(() => zodSchema.parse(3.14)).toThrow()
    })

    it('should convert boolean schema', () => {
      const schema: JsonSchema = { type: 'boolean' }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(true)).toBe(true)
      expect(zodSchema.parse(false)).toBe(false)
      expect(() => zodSchema.parse('true')).toThrow()
    })

    it('should convert null schema', () => {
      const schema: JsonSchema = { type: 'null' }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(null)).toBe(null)
      expect(() => zodSchema.parse(undefined)).toThrow()
    })

    it('should preserve descriptions', () => {
      const zodSchema = convertJsonSchemaToZod({ type: 'string', description: 'A user-facing value' })

      expect(zodSchema.description).toBe('A user-facing value')
    })
  })

  describe('nullable types', () => {
    it('should convert nullable string', () => {
      const schema: JsonSchema = { type: ['string', 'null'] }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse('hello')).toBe('hello')
      expect(zodSchema.parse(null)).toBe(null)
      expect(() => zodSchema.parse(123)).toThrow()
    })

    it('should convert nullable number', () => {
      const schema: JsonSchema = { type: ['number', 'null'] }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(42)).toBe(42)
      expect(zodSchema.parse(null)).toBe(null)
    })
  })

  describe('array types', () => {
    it('should convert array of strings', () => {
      const schema: JsonSchema = {
        type: 'array',
        items: { type: 'string' },
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
      expect(() => zodSchema.parse(['a', 1, 'c'])).toThrow()
    })

    it('should convert array of objects', () => {
      const schema: JsonSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['id', 'value'],
        },
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(
        zodSchema.parse([
          { id: 'test', value: 42 },
          { id: 'another', value: 100 },
        ]),
      ).toEqual([
        { id: 'test', value: 42 },
        { id: 'another', value: 100 },
      ])
      expect(() => zodSchema.parse([{ id: 'test' }])).toThrow()
    })

    it('should convert array without items', () => {
      const schema: JsonSchema = { type: 'array' }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse([1, 'two', null])).toEqual([1, 'two', null])
    })
  })

  describe('object types', () => {
    it('should convert simple object', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 })

      // Missing required field should fail
      expect(() => zodSchema.parse({ name: 'Alice' })).toThrow()
    })

    it('should convert object with optional properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse({ name: 'Bob' })).toEqual({ name: 'Bob' })

      // Can still provide optional field
      expect(zodSchema.parse({ name: 'Bob', age: 25 })).toEqual({ name: 'Bob', age: 25 })
    })

    it('should convert nested object', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
          },
        },
        required: ['user'],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(
        zodSchema.parse({
          user: { id: '123', name: 'Alice' },
        }),
      ).toEqual({ user: { id: '123', name: 'Alice' } })
    })

    it('should convert object with additionalProperties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: true,
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse({ name: 'test', extra: 'allowed' })).toEqual({ name: 'test', extra: 'allowed' })
    })

    it('should validate typed additional properties', () => {
      const zodSchema = convertJsonSchemaToZod({
        type: 'object',
        additionalProperties: { type: 'number' },
      })

      expect(zodSchema.parse({ count: 2 })).toEqual({ count: 2 })
      expect(() => zodSchema.parse({ count: 'two' })).toThrow()
    })

    it('should reject additional properties when disabled', () => {
      const zodSchema = convertJsonSchemaToZod({
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false,
      })

      expect(() => zodSchema.parse({ name: 'test', extra: true })).toThrow()
    })
  })

  describe('enum types', () => {
    it('should convert enum schema', () => {
      const schema: JsonSchema = {
        enum: ['red', 'green', 'blue'],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse('red')).toBe('red')
      expect(zodSchema.parse('green')).toBe('green')
      expect(() => zodSchema.parse('yellow')).toThrow()
    })

    it('should convert numeric enum', () => {
      const schema: JsonSchema = {
        enum: [1, 2, 3],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      expect(zodSchema.parse(1)).toBe(1)
      expect(zodSchema.parse(2)).toBe(2)
      expect(() => zodSchema.parse('1')).toThrow()
    })
  })

  describe('complex schemas', () => {
    it('should convert workflow step output schema', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              items: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['count', 'items'],
          },
        },
        required: ['success', 'message', 'data'],
      }

      const zodSchema = convertJsonSchemaToZod(schema)

      const validInput = {
        success: true,
        message: 'Done',
        data: {
          count: 5,
          items: ['a', 'b', 'c', 'd', 'e'],
        },
      }

      expect(zodSchema.parse(validInput)).toEqual(validInput)
    })

    it('should handle nullable complex types', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          metadata: {
            type: ['object', 'null'],
            properties: {
              timestamp: { type: 'string' },
            },
            required: ['timestamp'],
          },
        },
      }

      const zodSchema = convertJsonSchemaToZod(schema)

      // Can be object
      expect(zodSchema.parse({ metadata: { timestamp: '2024-01-01' } })).toEqual({
        metadata: { timestamp: '2024-01-01' },
      })

      // Can be null
      expect(zodSchema.parse({ metadata: null })).toEqual({ metadata: null })

      // Can be undefined (optional)
      expect(zodSchema.parse({})).toEqual({})
    })
  })

  describe('error messages', () => {
    it('should provide clear validation errors', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      const result = zodSchema.safeParse({ name: 'Alice' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
        const errorDetails = result.error.issues.map((e) => `  - ${e.path.join('.') || 'root'}: ${e.message}`).join('\n')

        expect(errorDetails).toContain('age')
      }
    })

    it('should handle nested validation errors', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { type: 'number' },
          },
        },
        required: ['data'],
      }
      const zodSchema = convertJsonSchemaToZod(schema)

      const result = zodSchema.safeParse({
        data: [1, 2, 'three', 4],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
        expect(result.error.issues[0].path).toEqual(['data', 2])
      }
    })
  })
})
