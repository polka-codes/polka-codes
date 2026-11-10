import { toJSONSchema, type z } from 'zod'
import type { JSONSchema } from 'zod/v4/core'

function jsonLiteral(value: string | number | boolean | null): string {
  return JSON.stringify(value)
}

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

type ContractContext = {
  definitionNames: ReadonlyMap<string, string>
}

function schemaToType(schema: JSONSchema._JSONSchema, indent = '', context: ContractContext): string {
  if (typeof schema === 'boolean') return schema ? 'unknown' : 'never'
  if (schema.$ref) {
    if (schema.$ref === '#') return 'Output'
    if (!schema.$ref.startsWith('#/$defs/')) return 'unknown'
    return context.definitionNames.get(schema.$ref.slice('#/$defs/'.length)) ?? 'unknown'
  }
  if (schema.const !== undefined) return jsonLiteral(schema.const)
  if (schema.enum) return schema.enum.map((value) => jsonLiteral(value)).join(' | ')

  const alternatives = [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]
  if (alternatives.length > 0) {
    return [...new Set(alternatives.map((alternative) => schemaToType(alternative, indent, context)))].join(' | ')
  }
  if (schema.allOf && schema.allOf.length > 0) {
    return schema.allOf.map((part) => schemaToType(part, indent, context)).join(' & ')
  }

  if (Array.isArray(schema.type)) return schema.type.map((type) => schemaToType({ type }, indent, context)).join(' | ')

  switch (schema.type) {
    case 'object': {
      const properties = Object.entries(schema.properties ?? {})
      const required = new Set(schema.required ?? [])
      const lines = properties.flatMap(([name, property]) => {
        const description = typeof property === 'boolean' ? undefined : schemaDescription(property)
        const comment = description ? [formatComment(description, `${indent}  `)] : []
        const optional = required.has(name) ? '' : '?'
        return [...comment, `${indent}  ${formatPropertyName(name)}${optional}: ${schemaToType(property, `${indent}  `, context)}`]
      })
      if (lines.length === 0) {
        if (schema.additionalProperties === false) return '{}'
        return `Record<string, ${schemaToType(schema.additionalProperties ?? {}, indent, context)}>`
      }
      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
        lines.push(`${indent}  [key: string]: ${schemaToType(schema.additionalProperties, `${indent}  `, context)}`)
      }
      return ['{', ...lines, `${indent}}`].join('\n')
    }
    case 'array': {
      if (Array.isArray(schema.prefixItems)) {
        return `[${schema.prefixItems.map((item) => schemaToType(item, indent, context)).join(', ')}]`
      }
      const items = Array.isArray(schema.items) ? schema.items[0] : schema.items
      return `Array<${schemaToType(items ?? {}, indent, context)}>`
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
  const jsonSchema = toJSONSchema(schema, { io: 'input', unrepresentable: 'any', reused: 'inline' }) as JSONSchema.BaseSchema
  const definitions = Object.entries(jsonSchema.$defs ?? {}).map(([key, schema], index) => ({
    key,
    name: `Definition${index + 1}`,
    schema,
  }))
  const definitionNames = new Map(definitions.map(({ key, name }) => [key, name]))
  const context: ContractContext = { definitionNames }
  const description = schemaDescription(jsonSchema)
  const declarations = [
    `type Output = ${schemaToType(jsonSchema, '', context)}`,
    ...definitions.map(({ name, schema: definition }) => `type ${name} = ${schemaToType(definition, '', context)}`),
  ]

  return [
    'The model output must be one JSON value described by this contract.',
    '<output_contract>',
    '```typescript',
    description ? `${formatComment(description, '')}\n${declarations.join('\n')}` : declarations.join('\n'),
    '```',
    '</output_contract>',
    '<output_instructions>',
    'Return exactly one JSON value.',
    'Use only declared properties. Do not return TypeScript, Markdown fences, commentary, or surrounding prose.',
    'Use null only where the contract declares a nullable value. Do not invent facts, identifiers, files, commands, or permissions.',
    'Validate the value against the contract before returning it.',
    '</output_instructions>',
  ].join('\n')
}
