import { toJSONSchema, type z } from 'zod'
import type { JSONSchema } from 'zod/v4/core'

function schemaDescription(schema: JSONSchema.BaseSchema): string | undefined {
  const descriptions = [schema.description]
  if (schema.format) descriptions.push(`Format: ${schema.format}.`)
  if (typeof schema.minLength === 'number') descriptions.push(`Minimum string length: ${schema.minLength}.`)
  if (typeof schema.maxLength === 'number') descriptions.push(`Maximum string length: ${schema.maxLength}.`)
  if (typeof schema.minimum === 'number') descriptions.push(`Minimum value: ${schema.minimum}.`)
  if (typeof schema.maximum === 'number') descriptions.push(`Maximum value: ${schema.maximum}.`)
  if (typeof schema.minItems === 'number') descriptions.push(`Minimum array length: ${schema.minItems}.`)
  if (typeof schema.maxItems === 'number') descriptions.push(`Maximum array length: ${schema.maxItems}.`)
  const text = descriptions.filter((value): value is string => Boolean(value)).join(' ')
  return text || undefined
}

function formatComment(description: string, indent: string): string {
  return description
    .split('\n')
    .map((line) => `${indent}// ${line}`)
    .join('\n')
}

function formatPropertyName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/u.test(name) ? name : JSON.stringify(name)
}

function schemaToType(schema: JSONSchema._JSONSchema, references: ReadonlyMap<string, string>, indent = ''): string {
  if (typeof schema === 'boolean') return schema ? 'unknown' : 'never'
  if (schema.$ref) return references.get(schema.$ref) ?? 'unknown'
  if (schema.const !== undefined) return JSON.stringify(schema.const)
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ')
  if (Array.isArray(schema.type)) {
    return [...new Set(schema.type.map((type) => schemaToType({ ...schema, type }, references, indent)))].join(' | ')
  }

  const alternatives = [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]
  if (alternatives.length > 0) {
    return [...new Set(alternatives.map((alternative) => schemaToType(alternative, references, indent)))].join(' | ')
  }
  if (schema.allOf && schema.allOf.length > 0) {
    return schema.allOf.map((part) => `(${schemaToType(part, references, indent)})`).join(' & ')
  }

  switch (schema.type) {
    case 'object': {
      const properties = Object.entries(schema.properties ?? {})
      const required = new Set(schema.required ?? [])
      const lines = properties.flatMap(([name, property]) => {
        const description = typeof property === 'boolean' ? undefined : schemaDescription(property)
        const comment = description ? [formatComment(description, `${indent}  `)] : []
        const optional = required.has(name) ? '' : '?'
        return [...comment, `${indent}  ${formatPropertyName(name)}${optional}: ${schemaToType(property, references, `${indent}  `)}`]
      })
      if (lines.length === 0) {
        if (schema.additionalProperties === false) return '{}'
        return `Record<string, ${schemaToType(schema.additionalProperties ?? {}, references, indent)}>`
      }
      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
        lines.push(`${indent}  [key: string]: ${schemaToType(schema.additionalProperties, references, `${indent}  `)}`)
      }
      return ['{', ...lines, `${indent}}`].join('\n')
    }
    case 'array': {
      const items = Array.isArray(schema.items) ? schema.items[0] : schema.items
      if (schema.prefixItems) {
        const elements = schema.prefixItems.map((item) => schemaToType(item, references, indent))
        if (items) elements.push(`...Array<${schemaToType(items, references, indent)}>`)
        return `[${elements.join(', ')}]`
      }
      return `Array<${schemaToType(items ?? {}, references, indent)}>`
    }
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    default:
      return 'unknown'
  }
}

export function buildStructuredOutputContract(schema: z.ZodType): string {
  const jsonSchema = toJSONSchema(schema, { io: 'input', unrepresentable: 'any', reused: 'inline' })
  const definitions = Object.entries(jsonSchema.$defs ?? {}).map(([key, schema], index) => ({
    key,
    name: `Definition${index + 1}`,
    schema,
  }))
  const references = new Map([['#', 'Output'], ...definitions.map(({ key, name }) => [`#/$defs/${key}`, name] as const)])
  const description = schemaDescription(jsonSchema)
  const declarations = [
    `type Output = ${schemaToType(jsonSchema, references)}`,
    ...definitions.map(({ name, schema: definition }) => `type ${name} = ${schemaToType(definition, references)}`),
  ].join('\n')

  return [
    'The model output must be one JSON value described by this contract.',
    '<output_contract>',
    '```typescript',
    description ? `${formatComment(description, '')}\n${declarations}` : declarations,
    '```',
    '</output_contract>',
    '<output_instructions>',
    'When finished, return exactly one JSON value matching the contract.',
    'Do not return TypeScript, Markdown fences, commentary, or surrounding prose.',
    '</output_instructions>',
  ].join('\n')
}
