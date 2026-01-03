import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

/**
 * Test the JSON Schema to Zod conversion logic
 * This is extracted from dynamic.ts for testing
 */

type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'

interface JsonSchema {
  type?: JsonSchemaType | JsonSchemaType[]
  enum?: any[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  additionalProperties?: boolean | JsonSchema
  description?: string
  [key: string]: any
}

function convertJsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  // Handle enum types
  if (schema.enum) {
    return z.enum(schema.enum.map((v: any) => String(v)))
  }

  // Handle union types (type: ["string", "null"])
  if (Array.isArray(schema.type)) {
    const types = schema.type
    if (types.includes('null') && types.length === 2) {
      const nonNullType = types.find((t) => t !== 'null')
      if (nonNullType === 'string') return z.string().nullable()
      if (nonNullType === 'number') return z.number().nullable()
      if (nonNullType === 'integer')
        return z
          .number()
          .refine((val) => Number.isInteger(val))
          .nullable()
      if (nonNullType === 'boolean') return z.boolean().nullable()
      if (nonNullType === 'object') {
        // Handle object with nullable - need to preserve properties
        const shape: Record<string, z.ZodTypeAny> = {}
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const propZod = convertJsonSchemaToZod(propSchema as JsonSchema)
            const isRequired = schema.required?.includes(propName)
            shape[propName] = isRequired ? propZod : propZod.optional()
          }
        }
        return z.object(shape).nullable()
      }
      if (nonNullType === 'array') return z.array(z.any()).nullable()
    }
    // Fallback for complex unions
    return z.any()
  }

  const type = schema.type as JsonSchemaType

  switch (type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'integer':
      return z.number().refine((val) => Number.isInteger(val), { message: 'Expected an integer' })
    case 'boolean':
      return z.boolean()
    case 'null':
      return z.null()
    case 'object': {
      const shape: Record<string, z.ZodTypeAny> = {}

      // Convert properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const propZod = convertJsonSchemaToZod(propSchema as JsonSchema)
          // Check if property is required
          const isRequired = schema.required?.includes(propName)
          shape[propName] = isRequired ? propZod : propZod.optional()
        }
      }

      let objectSchema: z.ZodTypeAny = z.object(shape)

      // Handle additionalProperties
      if (schema.additionalProperties === true) {
        objectSchema = objectSchema.and(z.any())
      } else if (typeof schema.additionalProperties === 'object') {
        const additionalSchema = convertJsonSchemaToZod(schema.additionalProperties as JsonSchema)
        objectSchema = objectSchema.and(z.record(z.string(), additionalSchema))
      }

      return objectSchema
    }
    case 'array': {
      if (!schema.items) {
        return z.array(z.any())
      }
      const itemSchema = convertJsonSchemaToZod(schema.items as JsonSchema)
      return z.array(itemSchema)
    }
    default:
      return z.any()
  }
}

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

      const result = zodSchema.parse([
        { id: 'test', value: 42 },
        { id: 'another', value: 100 },
      ])
      // Define expected schema type for assertion
      type ArrayItem = { id: string; value: number }
      const items = result as ArrayItem[]
      expect(items).toHaveLength(2)
      expect(items[0].id).toBe('test')
      expect(() => zodSchema.parse([{ id: 'test' }])).toThrow()
    })

    it('should convert array without items (fallback to any)', () => {
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

      const result = zodSchema.parse({ name: 'Alice', age: 30 })
      expect((result as any).name).toBe('Alice')
      expect((result as any).age).toBe(30)

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

      const result = zodSchema.parse({ name: 'Bob' })
      expect((result as any).name).toBe('Bob')
      expect((result as any).age).toBeUndefined()

      // Can still provide optional field
      const result2 = zodSchema.parse({ name: 'Bob', age: 25 })
      expect((result2 as any).age).toBe(25)
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

      const result = zodSchema.parse({
        user: { id: '123', name: 'Alice' },
      })
      expect((result as any).user.id).toBe('123')
      expect((result as any).user.name).toBe('Alice')
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

      const result = zodSchema.parse({ name: 'test', extra: 'allowed' })
      expect((result as any).name).toBe('test')
      expect((result as any).extra).toBe('allowed')
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

      expect(zodSchema.parse('1')).toBe('1')
      expect(zodSchema.parse('2')).toBe('2')
      expect(() => zodSchema.parse('4')).toThrow()
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

      const result = zodSchema.parse(validInput)
      expect((result as any).success).toBe(true)
      expect((result as any).message).toBe('Done')
      expect((result as any).data.count).toBe(5)
      expect((result as any).data.items).toHaveLength(5)
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
      const result1 = zodSchema.parse({ metadata: { timestamp: '2024-01-01' } })
      expect((result1 as any).metadata).toEqual({ timestamp: '2024-01-01' })

      // Can be null
      const result2 = zodSchema.parse({ metadata: null })
      expect((result2 as any).metadata).toBeNull()

      // Can be undefined (optional)
      const result3 = zodSchema.parse({})
      expect((result3 as any).metadata).toBeUndefined()
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

      expect((result as any).success).toBe(false)
      if (!result.success) {
        expect((result as any).error.issues).toBeDefined()
        expect((result as any).error.issues.length).toBeGreaterThan(0)
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

      expect((result as any).success).toBe(false)
      if (!result.success) {
        expect((result as any).error.issues).toBeDefined()
        expect((result as any).error.issues.length).toBeGreaterThan(0)
        expect((result as any).error.issues[0].path).toEqual(['data', 2])
      }
    })
  })
})
