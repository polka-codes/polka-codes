/**
 * Tests for generateProjectConfig AiTool
 * Generated by polka.codes
 */

import { describe, expect, test } from 'bun:test'
import generateProjectConfig from './generateProjectConfig'

describe('generateProjectConfig', () => {
  test('should format input correctly', () => {
    const files = ['package.json', '.polkacodes.yml']

    const input = generateProjectConfig.formatInput(files)
    expect(input).toBe('<tool_input>\npackage.json\n.polkacodes.yml\n</tool_input>')
  })

  test('should parse output correctly with all sections', () => {
    const output = `scripts:
  test:
    command: "bun test"
    description: "Run tests"

rules:
  - "Use bun as package manager"

excludeFiles:
  - ".env"
  - ".env.*"
  - "dist/"
  - "node_modules/"`

    const result = generateProjectConfig.parseOutput(output)
    expect(result).toBe(output)
  })

  test('should handle empty files array', () => {
    const files: string[] = []
    const input = generateProjectConfig.formatInput(files)
    expect(input).toBe('<tool_input>\n\n</tool_input>')
  })

  test('should trim whitespace in output', () => {
    const output = `
scripts:
  test:
    command: "bun test"
    description: "Run tests"

rules:
  - "Use bun as package manager"

excludeFiles:
  - ".env"
  - "dist/"
    `

    const result = generateProjectConfig.parseOutput(output)
    expect(result).toBe(output.trim())
  })

  test('should handle output with empty excludeFiles section', () => {
    const output = `scripts:
  test:
    command: "bun test"
    description: "Run tests"

rules:
  - "Use bun as package manager"

excludeFiles: []`

    const result = generateProjectConfig.parseOutput(output)
    expect(result).toBe(output)
  })

  test('should handle output with only excludeFiles section', () => {
    const output = `excludeFiles:
  - ".env"
  - ".env.*"
  - "node_modules/"
  - "dist/"`

    const result = generateProjectConfig.parseOutput(output)
    expect(result).toBe(output)
  })
})
