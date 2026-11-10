import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { buildStructuredOutputContract } from './structured-output-contract'

describe('buildStructuredOutputContract', () => {
  test('renders object structure, descriptions, limits, and JSON instructions', () => {
    const schema = z.strictObject({
      mode: z.enum(['ready', 'blocked']),
      summary: z.string().min(1).describe('One concise supported summary.'),
      items: z.array(z.string()).max(3),
      nextStep: z.string().nullable(),
    })

    const contract = buildStructuredOutputContract(schema)

    expect(contract).toContain('type Output = {')
    expect(contract).toContain('mode: "ready" | "blocked"')
    expect(contract).toContain('summary: string')
    expect(contract).toContain('nextStep: string | null')
    expect(contract).toContain('One concise supported summary.')
    expect(contract).toContain('Maximum array length: 3.')
    expect(contract).toContain('<output_contract>')
    expect(contract).toContain('<output_instructions>')
    expect(contract).toContain('Use only declared properties.')
    expect(contract).not.toContain('JSON Schema')
  })

  test('renders nested collections, records, tuples, and discriminated unions', () => {
    const schema = z.object({
      metadata: z.record(z.string(), z.number()),
      pair: z.tuple([z.string(), z.number()]),
      result: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('success'), value: z.string() }),
        z.object({ kind: z.literal('failure'), error: z.string() }),
      ]),
    })

    const contract = buildStructuredOutputContract(schema)

    expect(contract).toContain('metadata: Record<string, number>')
    expect(contract).toContain('pair: [string, number]')
    expect(contract).toContain('kind: "success"')
    expect(contract).toContain('kind: "failure"')
  })

  test('renders input types for transforms and preserves unsupported descriptions', () => {
    const schema = z.object({
      length: z.string().transform((value) => value.length),
      generatedAt: z.coerce.date().describe('ISO timestamp'),
    })

    const contract = buildStructuredOutputContract(schema)

    expect(contract).toContain('length: string')
    expect(contract).toContain('generatedAt: unknown')
    expect(contract).toContain('ISO timestamp')
  })

  test('is deterministic for broad schemas', () => {
    const schema = z.any()

    expect(buildStructuredOutputContract(schema)).toBe(buildStructuredOutputContract(schema))
    expect(buildStructuredOutputContract(schema)).toContain('type Output = unknown')
  })

  test('renders recursive root references using the generated output name', () => {
    const node: z.ZodType<{ value: string; children: Array<{ value: string; children: unknown[] }> }> = z.lazy(() =>
      z.object({
        value: z.string(),
        children: z.array(node),
      }),
    )

    const contract = buildStructuredOutputContract(node)

    expect(contract).toContain('children: Array<Output>')
    expect(contract).not.toContain('Array<#>')
  })

  test('renders recursive definitions nested inside the output', () => {
    let node: z.ZodTypeAny
    node = z.object({
      value: z.string(),
      children: z.array(z.lazy(() => node)),
    })

    const contract = buildStructuredOutputContract(z.object({ tree: node }))

    expect(contract).toContain('tree: Definition1')
    expect(contract).toContain('type Definition1 = {')
    expect(contract).toContain('children: Array<Definition1>')
  })
})
